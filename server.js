const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const multer = require("multer");
const fs = require("fs");
const csvParser = require("csv-parser"); // Install this package for parsing CSV files

const modifyVoterInfo = require("./voter_information");

const app = express();
const port = 3000;

app.use(bodyParser.json());
// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files from the current directory

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

  // Check if user is a voter
  const voterQuery = "SELECT * FROM voter WHERE v_email = ? AND password = ?";
  db.query(voterQuery, [email, password], (err, voterResults) => {
    if (err) {
      console.error("Error querying the database for voter:", err);
      return res.status(500).send("Server error");
    }

    if (voterResults.length > 0) {
      // Voter exists, redirect to voter dashboard
      return res.redirect("/voter/voter_dashboard.html");
    }

    // Check if user is a candidate
    const candidateQuery = "SELECT * FROM candidate WHERE c_email = ? AND password = ?";
    db.query(candidateQuery, [email, password], (err, candidateResults) => {
      if (err) {
        console.error("Error querying the database for candidate:", err);
        return res.status(500).send("Server error");
      }

      if (candidateResults.length > 0) {
        // Candidate exists, redirect to candidate dashboard
        return res.redirect("/Candidate/candidate_dashboard.html");
      }

      // Check if user is an admin
      const adminQuery = "SELECT * FROM admin WHERE email = ? AND password = ?";
      db.query(adminQuery, [email, password], (err, adminResults) => {
        if (err) {
          console.error("Error querying the database for admin:", err);
          return res.status(500).send("Server error");
        }

        if (adminResults.length > 0) {
          // Admin exists, redirect to admin dashboard
          return res.redirect("/admin/admin_dashboard.html");
        }

        // If no match found, user is not found in any table
        res.redirect("/login.html?error=invalid");
      });
    });
  });
});

// Serve static files from the admin folder
app.use(express.static(__dirname + "/admin"));

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


// Fetch all elections
app.get("/api/elections", (req, res) => {
  const query = "SELECT id, electionName FROM elections"; // Adjust the query as per your table structure

  db.query(query, (err, results) => {
      if (err) {
          console.error("Error fetching elections:", err);
          return res.status(500).json({ error: "Server error" });
      }
      res.json(results); // Return the list of elections
  });
});

// Fetch election details by election ID
app.get('/api/election_details', (req, res) => {
  const electionQuery = `
      SELECT d.designationName AS designationName, c.candidateName AS candidateName, c.symbol 
      FROM designations d
      JOIN candidate c ON d.designationId = c.designationId
      ORDER BY d.designationId;
  `;

  db.query(electionQuery, (err, results) => {
      if (err) {
          console.error('Error fetching election details:', err);
          res.status(500).json({ error: 'Failed to fetch election details' });
          return;
      }

      const designations = {};
      results.forEach((row) => {
          if (!designations[row.designationName]) {
              designations[row.designationName] = {
                  designationName: row.designationName,
                  candidate: [],
              };
          }

          // Convert symbol to Base64 if it's a BLOB
          const symbolBase64 = row.symbol ? row.symbol.toString('base64') : null;

          designations[row.designationName].candidate.push({
              candidateName: row.candidateName,
              symbol: symbolBase64 ? `data:image/jpeg;base64,${symbolBase64}` : null, // Embed Base64 data URI
          });
      });

      res.json({ designations: Object.values(designations) });
  });
});



modifyVoterInfo(app);

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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
