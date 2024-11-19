const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const multer = require("multer");
const fs = require("fs");
const csvParser = require("csv-parser"); // Install this package for parsing CSV files
const session = require("express-session");
const modifyVoterInfo = require("./voter_information");

const app = express();
const port = 3000;

app.use(bodyParser.json());
// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files from the current directory
app.use(session({
  secret: 'your-secret-key', // Replace with a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));
// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Create MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // Your MySQL password
  database: "evoting_system", // Your database name
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL Database");
});


const electionRoutes = require("./admin/election_launch")(db);
app.use("/admin", electionRoutes);


// Handle signup form submission
app.post("/registration_form", (req, res) => {
  const { username, email, dateOfBirth, address, password } = req.body;

  // Insert user data into the database
  const query =
    "INSERT INTO voter (username, v_email, dateOfBirth, address, password) VALUES (?, ?, ?, ?, ?)";
  db.query(
    query,
    [username, email, dateOfBirth, address, password],
    (err, result) => {
      if (err) {
        console.error("Error inserting data into the database:", err);
        res.status(500).send("Server error");
        return;
      }
      res.send(
        'Signup successful! You can now <a href="login.html">Log in</a>.'
      );
    }
  );
});

// Start login page backend
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("Received login request for email:", email);

  // Check if user is a voter
  const voterQuery = "SELECT * FROM voter WHERE v_email = ? AND password = ?";
  db.query(voterQuery, [email, password], (err, voterResults) => {
    if (err) {
      console.error("Error querying the database for voter:", err);
      return res.status(500).send("Server error");
    }

    if (voterResults.length > 0) {
      console.log("User found in voter table:", email);
      req.session.userEmail = email;
      // Voter exists, redirect to voter dashboard
      return res.redirect("/voter/voter_dashboard.html");
    }

    console.log("User not found in voter table:", email);

    // Check if user is a candidate
    const candidateQuery = "SELECT * FROM candidate WHERE c_email = ? AND password = ?";
    db.query(candidateQuery, [email, password], (err, candidateResults) => {
      if (err) {
        console.error("Error querying the database for candidate:", err);
        return res.status(500).send("Server error");
      }

      if (candidateResults.length > 0) {
        console.log("User found in candidate table:", email);
        req.session.userEmail = email;
        // Candidate exists, redirect to candidate dashboard
        return res.redirect("/Candidate/candidate_dashboard.html");
      }

      console.log("User not found in candidate table:", email);

      // Check if user is an admin
      const adminQuery = "SELECT * FROM admin WHERE email = ? AND password = ?";
      db.query(adminQuery, [email, password], (err, adminResults) => {
        if (err) {
          console.error("Error querying the database for admin:", err);
          return res.status(500).send("Server error");
        }

        if (adminResults.length > 0) {
          console.log("User found in admin table:", email);
          req.session.userEmail = email;
          // Admin exists, redirect to admin dashboard
          return res.redirect("/admin/admin_dashboard.html");
        }

        console.log("User not found in any table:", email);

        // If no match found, user is not found in any table
        res.redirect("/login.html?error=invalid");
      });
    });
  });
});

// End of login page backend

// Endpoint to handle file uploads
// Serve static files from the admin folder
app.use(express.static(__dirname + "/admin"));

app.get("/getUserData", (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const userEmail = req.session.userEmail;

  // Query for all possible user roles
  const queries = [
    `SELECT username, v_email AS email FROM voter WHERE v_email = ?`,
    `SELECT candidateName AS username, c_email AS email FROM candidate WHERE c_email = ?`,
    `SELECT username, email FROM admin WHERE email = ?`
  ];

  let found = false;

  queries.forEach((query, index) => {
    db.query(query, [userEmail], (err, results) => {
      if (err) {
        console.error("Error fetching user data:", err);
        if (!found && index === queries.length - 1) res.status(500).json({ error: "Server error" });
        return;
      }

      if (results.length > 0 && !found) {
        found = true;
        const user = results[0];
        res.json({ username: user.username, email: user.email });
      } else if (index === queries.length - 1 && !found) {
        res.status(404).json({ error: "User not found" });
      }
    });
  });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    res.redirect('/login.html');   // Redirect to the login page
  });
});



app.get("/api/elections", (req, res) => {
  const query = "SELECT electionId, electionName FROM elections"; // Adjust the query as per your table structure

  db.query(query, (err, results) => {
      if (err) {
          console.error("Error fetching elections:", err);
          return res.status(500).json({ error: "Server error" });
      }
      res.json(results); // Return the list of elections
  });
});

// Fetch election details by election ID
app.post('/api/submit_votes', (req, res) => {
  // Check if the user is logged in (session must contain the user's email)
  if (req.session && req.session.userEmail) {
      const voterEmail = req.session.userEmail;  // Access email from session
      console.log('Logged in email:', voterEmail);

      // Get the selected candidates from the request body
      const { candidates } = req.body;
      
      // Ensure that the candidates array is not empty
      if (!Array.isArray(candidates) || candidates.length === 0) {
          return res.status(400).json({ error: 'No candidates selected.' });
      }

      
      console.log('Selected candidates (c_email):', candidates);
      const checkQuery = 'SELECT * FROM vote WHERE v_email = ?';
      db.query(checkQuery, [voterEmail], (err, results) => {
          if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Database error.' });
          }
          
         
          if (results.length > 0) {
              return res.status(403).json({ error: 'You have already voted.' });
          }

          
          const insertQuery = 'INSERT INTO vote (c_email, v_email) VALUES (?, ?)';

          // Create an array of promises to insert votes for each selected candidate
          const insertPromises = candidates.map(cEmail => new Promise((resolve, reject) => {
              db.query(insertQuery, [cEmail, voterEmail], (err) => {
                  if (err) {
                      reject(err);
                  } else {
                      resolve();
                  }
              });
          }));

          // Wait for all insertions to finish
          Promise.all(insertPromises)
              .then(() => {
                  // All votes have been successfully inserted
                  res.json({ message: 'Votes submitted successfully!' });
              })
              .catch((err) => {
                  console.error('Error inserting votes:', err);
                  res.status(500).json({ error: 'Failed to submit votes.' });
              });
      });
  } else {
      // User is not logged in
      res.status(401).json({ error: 'User not logged in.' });
  }
});


app.get("/api/election_details", (req, res) => {
    const electionId = '1'; // Example electionId

    const query = `
        SELECT 
            d.designationId, 
            d.designationName, 
            c.candidateName,
            c.c_email,  -- Include the candidate's email
            c.symbol
        FROM 
            designations d
        LEFT JOIN 
            candidate c ON d.designationId = c.designationId
        WHERE 
            d.electionId = ?`;

    db.query(query, [electionId], (err, results) => {
        if (err) {
            console.error("Error fetching election details:", err);
            return res.status(500).json({ error: "Server error" });
        }

        const designations = {};
        results.forEach(row => {
            const { designationId, designationName, candidateName, c_email, symbol } = row;

            if (!designations[designationId]) {
                designations[designationId] = {
                    designationName,
                    candidate: []
                };
            }

            if (candidateName) {
                // Convert BLOB to Base64
                const base64Symbol = symbol 
                    ? `data:image/jpeg;base64,${symbol.toString('base64')}`
                    : null;

                designations[designationId].candidate.push({
                    candidateName,
                    email: c_email,
                    symbol: base64Symbol // Add the Base64 image
                });
            }
        });

        // Send the designations object as JSON
        res.json({ designations: Object.values(designations) });
    });
});

modifyVoterInfo(app);

// Endpoint to fetch results

app.get('/results', (req, res) => {

  const electionId = 1; // Fixed election ID


  const sql = `

      SELECT 
    d.designationId,  -- Ensure you select the designationId
    d.designationName, 
    c.candidateName, 
    c.c_email, 
    COUNT(v.v_email) AS voteCount,
    CASE 
        WHEN COUNT(v.v_email) = maxVote.maxVote THEN 1 
        ELSE 0 
    END AS isWinner
FROM 
    candidate c
JOIN 
    designations d ON c.designationId = d.designationId
LEFT JOIN 
    vote v ON c.c_email = v.c_email
LEFT JOIN 
    (SELECT designationId, MAX(voteCount) AS maxVote 
     FROM (
        SELECT 
            c.designationId, 
            COUNT(v.v_email) AS voteCount 
        FROM 
            candidate c
        LEFT JOIN 
            vote v ON c.c_email = v.c_email
        GROUP BY 
            c.c_email
    ) AS counts GROUP BY designationId) AS maxVote ON d.designationId = maxVote.designationId
WHERE 
    d.electionId = ?
GROUP BY 
    d.designationId, c.c_email`;


  db.query(sql, [electionId], (error, results) => {

      if (error) {

          return res.status(500).json({ error: 'Database query failed' });

      }

      res.json(results);

  });

});


// Endpoint to publish results

app.post('/publish-results', (req, res) => {

  const electionId = 1; // Fixed election ID

  const sqlInsert = `

      INSERT INTO results (electionId, designationId, candidateEmail, voteCount, isWinner)

      VALUES (?, ?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE voteCount = ?, isWinner = ?;`;


  const results = req.body; // Expecting results from the client


  const queries = results.map(row => {

      return new Promise((resolve, reject) => {

          db.query(sqlInsert, [

              electionId,

              row.designationId,

              row.c_email,

              row.voteCount,

              row.isWinner,

              row.voteCount,

              row.isWinner

          ], (error) => {

              if (error) return reject(error);

              resolve();

          });

      });

  });


  Promise.all(queries)

      .then(() => res.json({ message: 'Results published successfully!' }))

      .catch(err => {

          console.error('Error publishing results:', err);

          res.status(500).json({ error: 'Failed to publish results: ' + err.message });

      });

});

// Endpoint to get results from the results table

app.get('/api/results', (req, res) => {

  const query = `

      SELECT 

          d.designationName AS post, 

          r.candidateEmail AS candidateName, 

          r.voteCount, 

          r.isWinner 

      FROM 

          results r 

      JOIN 

          designations d ON r.designationId = d.designationId 

      WHERE 

          r.electionId = 1;`; // Fixed electionId = 1


  db.query(query, (err, results) => {

      if (err) {

          console.error('Error fetching results:', err);

          return res.status(500).json({ error: 'Database query error' });

      }
      // Group results by designation and find winners

      const groupedResults = results.reduce((acc, result) => {

          const { post, candidateName, voteCount, isWinner } = result;


          if (!acc[post]) {
              acc[post] = {
                  post,
                  candidates: [],
                  winner: null
              };
          }
          acc[post].candidates.push({ candidateName, voteCount });
          // Determine the winner

          if (isWinner) {

              acc[post].winner = { candidateName, voteCount };

          }
          return acc;

      }, {});
      res.json(Object.values(groupedResults)); // Send the grouped results as JSON
  });
});

// Fetch the candidate name and position from database
// In launch_election.js or server.js
app.get('/candidate', (req, res) => {
  const query = `
    SELECT c.candidateName AS candidateName, c.c_email, d.designationName AS designation
    FROM candidate c
    LEFT JOIN designations d ON c.designationId = d.designationId
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching candidate data:", err);
      res.status(500).json({ message: "Error fetching candidate data" });
    } else {
      res.json(results);
    }
  });
});


// Endpoint to fetch total candidate count
app.get('/api/candidateCount', (req, res) => {
  const query = "SELECT COUNT(*) AS count FROM candidate";
  
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching candidate count:", err);
      res.status(500).send("Server error");
      return;
    }

    // Send the count as a JSON response
    res.json({ count: results[0].count });
  });
});

// Endpoint to fetch total voter count
app.get('/api/voterCount', (req, res) => {
  const query = 'SELECT COUNT(*) as count FROM voter';
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching voter count:", err);
      return res.status(500).send("Server error");
    }
    res.json({ count: results[0].count }); // Send the count as JSON response
  });
});

// Show voter list
app.get("/voter", (req, res) => {
  const query = "SELECT username, v_email, dateOfBirth, address FROM voter"; 
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching voter data:", err);
      return res.status(500).send("Server error");
    }
    res.json(results); // Send the fetched data as JSON response
  });
});
app.get("/candidates", (req, res) => {
  const { page = 1, limit = 10 } = req.query; // Default values
  const offset = (page - 1) * limit;
  const query = `SELECT candidateName, c_email, symbol, electionId, designationId FROM candidate LIMIT ? OFFSET ?`;
  db.query(query, [Number(limit), Number(offset)], (err, results) => {
    if (err) {
      console.error("Error fetching candidates:", err);
      return res.status(500).json({ error: "Server error" });
    }
    const candidates = results.map(candidate => ({
      ...candidate,
      symbol: candidate.symbol ? Buffer.from(candidate.symbol).toString("base64") : null,
    }));
    res.json(candidates);
  });
});



app.get("/elections", (req, res) => {
  const query = `
    SELECT e.electionId, e.electionName, e.electionDate, d.designationName
    FROM elections e
    LEFT JOIN designations d ON e.electionId = d.electionId
    ORDER BY e.electionId
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching election data:", err);
      return res.status(500).json({ error: "Server error" });
    }

    // Process results to group designations by election
    const elections = results.reduce((acc, row) => {
      const { electionId, electionName, electionDate, designationName } = row;

      // Check if this electionId already exists in the accumulator
      const existingElection = acc.find((e) => e.electionId === electionId);

      if (existingElection) {
        // If it exists, just add the designation to the existing array
        existingElection.designations.push(designationName);
      } else {
        // If it does not exist, create a new entry for the election
        acc.push({
          electionId,
          electionName,
          electionDate,
          designations: [designationName], // Initialize with the first designation
        });
      }

      return acc;
    }, []);

    // Send the grouped election data as JSON
    res.json(elections);
  });
});


app.put("/elections/:id", (req, res) => {
  const electionId = req.params.id;
  const { electionName, electionDate, designations } = req.body;

  // Update the election's name and date
  const updateElectionQuery = `
    UPDATE elections
    SET electionName = ?, electionDate = ?
    WHERE electionId = ?
  `;

  db.query(updateElectionQuery, [electionName, electionDate, electionId], (err, result) => {
    if (err) {
      console.error("Error updating election:", err);
      return res.status(500).json({ error: "Server error" });
    }

    // Optional: Update designations here if needed (assumes one-to-many relationship)
    // Remove old designations and re-add new ones
    const deleteDesignationsQuery = `DELETE FROM designations WHERE electionId = ?`;
    db.query(deleteDesignationsQuery, [electionId], (err) => {
      if (err) {
        console.error("Error deleting old designations:", err);
        return res.status(500).json({ error: "Server error" });
      }

      // Insert new designations
      const insertDesignationQuery = `INSERT INTO designations (electionId, designationName) VALUES (?, ?)`;
      const designationPromises = designations.map((designation) =>
        new Promise((resolve, reject) => {
          db.query(insertDesignationQuery, [electionId, designation], (err, result) => {
            if (err) {
              return reject(err);
            }
            resolve(result);
          });
        })
      );

      Promise.all(designationPromises)
        .then(() => res.json({ success: true, message: "Election updated successfully!" }))
        .catch((err) => {
          console.error("Error updating designations:", err);
          res.status(500).json({ error: "Server error" });
        });
    });
  });
});



app.delete("/voter/:email", (req, res) => {
  const email = req.params.email;
  const query = "DELETE FROM voter WHERE v_email = ?";
  db.query(query, [email], (err, result) => {
    if (err) {
      console.error("Error deleting voter:", err);
      return res.status(500).send("Server error");
    }
    res.sendStatus(204); // No content to send back
  });
});


app.get("/candidatesWithPost", (req, res) => {
  const query = `
    SELECT 
    c.candidateName, 
    c.symbol, 
    GROUP_CONCAT(d.designationName) AS designations
FROM 
    candidate c
LEFT JOIN 
    designations d ON c.designationId = d.id
GROUP BY 
    c.candidateName, c.symbol;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching candidates with posts:", err);
      return res.status(500).send("Server error");
    }
    // Format the results to include designations as an array
    const formattedResults = results.map(candidate => ({
      ...candidate,
      designations: candidate.designations ? candidate.designations.split(",") : [],
    }));

    res.json(formattedResults);
  });
});



// Endpoint to fetch admin information
app.get("/api/admin", (req, res) => {
  const query = "SELECT username, email FROM admin"; // Fetching username and email
  
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching admin data:", err);
      return res.status(500).json({ error: "Server error" });
    }
    res.json(results); // Send the fetched data as JSON response
  });
});

// Endpoint to get candidate data
app.get('/api/candidate', (req, res) => {
  const candidateId = 1; // Use a dynamic ID or request param as needed

  db.query('SELECT candidateName, c_email, designationId FROM candidate WHERE id = ?', [candidateId], (err, result) => {
      if (err) {
          console.error("Error fetching candidate data:", err);
          res.status(500).json({ error: "Database query error" });
          return;
      }
      if (result.length > 0) {
          res.json(result[0]); // Send the candidate data
      } else {
          res.status(404).json({ error: "Candidate not found" });
      }
  });
});




// Submit the votes
app.post('/api/submitVote', (req, res) => {
  const { votes } = req.body;

  if (!votes || votes.length === 0) {
      return res.status(400).json({ success: false, message: 'No votes selected' });
  }

  const voteEntries = votes.map(vote => [vote]);
  const query = 'INSERT INTO vote (c_email, v_email) VALUES ?';

  connection.query(query, [voteEntries], (err, result) => {
      if (err) {
          console.error('Error submitting vote:', err);
          return res.status(500).json({ success: false, message: 'Error submitting votes' });
      }

      res.json({ success: true, message: 'Votes submitted successfully' });
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
