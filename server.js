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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); 
app.use(session({
  secret: 'your-secret-key', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));
// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); 
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
  password: "", 
  database: "evoting_system", 
});


db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL Database");
});

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Multer setup for file uploads





// Routes

// Get designations for dropdown
// Fetch designations
app.get('/getDesignations', (req, res) => {
  db.query('SELECT designationId, designationName FROM designations', (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Error fetching designations' });
      }
      res.json(results); // Results should contain 'id' and 'designationName'
  });
});

// Fetch elections
app.get('/getElections', (req, res) => {
  db.query('SELECT electionId, electionName FROM elections', (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Error fetching elections' });
      }
      res.json(results); // Results should contain 'id' and 'electionName'
  });
});


// Add candidate route
app.post('/addCandidate', upload.single('symbol'), (req, res) => {
    const { candidateName, c_email, designationId, electionId } = req.body;
    const password = 'defaultpassword123'; // Default password for new candidates
    const symbol = fs.readFileSync(req.file.path); // Reading uploaded symbol image file

    // Check if the email already exists
    db.query('SELECT * FROM candidate WHERE c_email = ?', [c_email], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error checking candidate email' });
        }

        if (results.length > 0) {
            return res.status(400).json({ message: 'Candidate with this email already exists' });
        }

        // Insert new candidate
        const query = 'INSERT INTO candidate (candidateName, c_email, password, symbol, electionId, designationId) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(query, [candidateName, c_email, password, symbol, electionId, designationId], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Error adding candidate' });
            }
            // Delete uploaded file after storing in DB
            fs.unlinkSync(req.file.path);

            res.json({ success: true, message: 'Candidate added successfully!' });
        });
    });
});
const electionRoutes = require("./admin/election_launch")(db);
app.use("/admin", electionRoutes);

// Handle signup form submission
app.post("/registration_form", (req, res) => {
  const { username, email, dateOfBirth, address, password } = req.body;

  
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
      res.redirect("/login.html");
    }
  );
});


// New Route: Approve Voter
app.post("/approve_voter", (req, res) => {
  const { voterId } = req.body;

  
  const query = "UPDATE voter SET status = 'approved' WHERE v_email = ?";
  db.query(query, [voterId], (err, result) => {
    if (err) {
      console.error("Error updating voter status:", err);
      return res.status(500).send("Failed to approve voter.");
    }

    if (result.affectedRows > 0) {
      res.send("Voter approved successfully.");
    } else {
      res.status(404).send("Voter not found.");
    }
  });
});

// Update Login Logic
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("Received login request for email:", email);

  
  const voterQuery = "SELECT * FROM voter WHERE v_email = ? AND password = ?";
  db.query(voterQuery, [email, password], (err, voterResults) => {
    if (err) {
      console.error("Error querying the database for voter:", err);
      return res.status(500).send("Server error");
    }

    if (voterResults.length > 0) {
      const voter = voterResults[0];
      if (voter.status === "approved") {
        console.log("Approved voter found:", email);
        req.session.userEmail = email;
        
        return res.redirect("/voter/voter_dashboard.html");
      } else {
        console.log("Voter not approved:", email);
        // Redirect to login page with 'pendingApproval' error
        return res.redirect("/login.html?error=pendingApproval");
      }
    }

    console.log("User not found or not approved in voter table:", email);

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
        // Redirect to candidate dashboard
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
          // Redirect to admin dashboard
          return res.redirect("/admin/admin_dashboard.html");
        }

        console.log("User not found in any table:", email);

        
        return res.redirect("/login.html?error=invalid");
      });
    });
  });
});

// Deny voter
app.post('/deny_voter', (req, res) => {
  const voterEmail = req.body.voterId;
  const sql = `DELETE FROM voter WHERE v_email = ?`;
  db.query(sql, [voterEmail], (err, result) => {
      if (err) {
          console.error('Error deleting voter:', err);
          res.status(500).send('Error denying voter.');
          return;
      }
      res.send('Voter denied successfully.');
  });
});




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
    res.clearCookie('connect.sid');
    res.redirect('/login.html');   
  });
});



app.get("/api/elections", (req, res) => {
  const query = "SELECT electionId, electionName FROM elections"; 

  db.query(query, (err, results) => {
      if (err) {
          console.error("Error fetching elections:", err);
          return res.status(500).json({ error: "Server error" });
      }
      res.json(results); 
  });
});

// Fetch election details by election ID
app.post('/api/submit_votes', (req, res) => {
  if (req.session && req.session.userEmail) {
      const voterEmail = req.session.userEmail; 
      console.log('Logged in email:', voterEmail);

      const { candidates } = req.body;

      
      if (!Array.isArray(candidates)) {
          return res.status(400).json({ error: 'Invalid request format.' });
      }

      // Check if the voter has already voted
      const checkQuery = 'SELECT * FROM vote WHERE v_email = ?';
      db.query(checkQuery, [voterEmail], (err, results) => {
          if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Database error.' });
          }

          if (results.length > 0) {
              return res.status(403).json({ error: 'You have already voted.' });
          }

          // Get the next BallotNo
          const ballotNoQuery = 'SELECT MAX(BallotNo) AS maxBallotNo FROM vote';
          db.query(ballotNoQuery, (err, results) => {
              if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Failed to generate BallotNo.' });
              }

              const nextBallotNo = (results[0].maxBallotNo || 0) + 1;

              // Check if we do not give any vote  
              if (candidates.length === 0) {
                  // Insert votes for all candidates with is_vote = 0
                  const allCandidatesQuery = 'SELECT id FROM candidate';
                  db.query(allCandidatesQuery, (err, candidateResults) => {
                      if (err) {
                          console.error('Database error:', err);
                          return res.status(500).json({ error: 'Failed to retrieve candidates.' });
                      }

                      const insertPromises = candidateResults.map((candidate) => new Promise((resolve, reject) => {
                          const insertQuery = 'INSERT INTO vote (candidate_id, v_email, BallotNo, is_vote) VALUES (?, ?, ?, 0)';
                          db.query(insertQuery, [candidate.id, voterEmail, nextBallotNo], (err) => {
                              if (err) {
                                  reject(err);
                              } else {
                                  resolve();
                              }
                          });
                      }));

                      Promise.all(insertPromises)
                          .then(() => {
                              res.json({ message: 'Vote submitted without selecting any candidate.', BallotNo: nextBallotNo });
                          })
                          .catch((err) => {
                              console.error('Error inserting votes:', err);
                              res.status(500).json({ error: 'Failed to submit votes.' });
                          });
                  });
              } else {
                  // Resolve candidate IDs for the selected candidates
                  const candidateIdQuery = 'SELECT id FROM candidate WHERE c_email IN (?)';
                  db.query(candidateIdQuery, [candidates], (err, idResults) => {
                      if (err) {
                          console.error('Database error:', err);
                          return res.status(500).json({ error: 'Failed to retrieve candidate IDs.' });
                      }

                      const candidateIds = idResults.map(row => row.id);

                      // Insert votes for selected candidates with is_vote = 1
                      const insertPromises = candidateIds.map((candidateId) => new Promise((resolve, reject) => {
                          const insertQuery = 'INSERT INTO vote (candidate_id, v_email, BallotNo, is_vote) VALUES (?, ?, ?, 1)';
                          db.query(insertQuery, [candidateId, voterEmail, nextBallotNo], (err) => {
                              if (err) {
                                  reject(err);
                              } else {
                                  resolve();
                              }
                          });
                      }));

                      Promise.all(insertPromises)
                          .then(() => {
                              res.json({ message: 'Votes submitted successfully!', BallotNo: nextBallotNo });
                          })
                          .catch((err) => {
                              console.error('Error inserting votes:', err);
                              res.status(500).json({ error: 'Failed to submit votes.' });
                          });
                  });
              }
          });
      });
  } else {
      res.status(401).json({ error: 'User not logged in.' });
  }
});


app.get("/api/election_details", (req, res) => {
    const electionId = '1'; 

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
                    symbol: base64Symbol 
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
  const electionId = 1; 
  const sql = `
      SELECT 
          d.designationId, 
          d.designationName, 
          c.candidateName, 
          c.id, 
          COUNT(v.vote_id) AS voteCount,
          CASE 
              WHEN COUNT(v.vote_id) = (
                  SELECT MAX(voteCount)
                  FROM (
                      SELECT 
                          c.designationId, 
                          COUNT(v.vote_id) AS voteCount
                      FROM candidate c
                      LEFT JOIN vote v ON c.id = v.candidate_id AND v.is_vote = 1
                      GROUP BY c.id
                  ) AS maxVotes 
                  WHERE maxVotes.designationId = d.designationId
              ) THEN 1
              ELSE 0
          END AS isWinner
      FROM 
          candidate c
      JOIN 
          designations d ON c.designationId = d.designationId
      LEFT JOIN 
          vote v ON c.id = v.candidate_id AND v.is_vote = 1
      WHERE 
          d.electionId = ?
      GROUP BY 
          c.id
  `;

  db.query(sql, [electionId], (error, results) => {
      if (error) {
          return res.status(500).json({ error: 'Failed to fetch results' });
      }
      res.json(results);
  });
});

// Route to publish results
app.post('/publish-results', (req, res) => {
const electionId = 1; // Fixed election ID

// DELETE query to remove existing results for this election
const sqlDelete = 'DELETE FROM results WHERE electionId = ?';

//   add new results
const sqlInsert = `
    INSERT INTO results (electionId, designationId, candidateEmail, voteCount, isWinner)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE voteCount = ?, isWinner = ?;`;

const results = req.body; 

// Start by deleting existing results
db.query(sqlDelete, [electionId], (deleteError) => {
    if (deleteError) {
        console.error('Error deleting old results:', deleteError);
        return res.status(500).json({ error: 'Failed to delete old results: ' + deleteError.message });
    }

    // Insert new results
    const queries = results.map((row) => {
        return new Promise((resolve, reject) => {
            db.query(
                sqlInsert,
                [
                    electionId,
                    row.designationId,
                    row.c_email,
                    row.voteCount,
                    row.isWinner,
                    row.voteCount,
                    row.isWinner,
                ],
                (insertError) => {
                    if (insertError) return reject(insertError);
                    resolve();
                }
            );
        });
    });

    
    Promise.all(queries)
        .then(() => res.json({ message: 'Results published successfully!' }))
        .catch((err) => {
            console.error('Error publishing results:', err);
            res.status(500).json({ error: 'Failed to publish results: ' + err.message });
     });
 });
});


// Endpoint to publish results

app.post('/publish-results', (req, res) => {

  const electionId = 1; 

  const sqlInsert = `

      INSERT INTO results (electionId, designationId, c_email, voteCount, isWinner)

      VALUES (?, ?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE voteCount = ?, isWinner = ?;`;


  const results = req.body; 


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
      res.json(Object.values(groupedResults)); 
  });
});

//  candidate name and position from database

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

    
    res.json({ count: results[0].count });
  });
});


app.get('/api/voterCount', (req, res) => {
  const query = 'SELECT COUNT(*) as count FROM voter';
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching voter count:", err);
      return res.status(500).send("Server error");
    }
    res.json({ count: results[0].count }); 
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

  const query = `
    SELECT 
      candidate.candidateName, 
      candidate.c_email, 
      candidate.symbol, 
      elections.electionName, 
      designations.designationName
    FROM candidate
    JOIN elections ON candidate.electionId = elections.electionId
    JOIN designations ON candidate.designationId = designations.designationId
    LIMIT ? OFFSET ?;
  `;

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
app.get("/get_pending_voters", (req, res) => {
  const query = "SELECT * FROM voter WHERE status = 'pending'";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching pending voters:", err);
      return res.status(500).json({ error: "Failed to fetch pending voters" });
    }
    res.json(results); // Send the fetched voters as a JSON response
  });
});


app.get('/getVoters', (req, res) => {
  db.query('SELECT * FROM voter', (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database query failed' });
      return;
    }
    res.json(results);
  });
});

// Update voter details
app.post('/updateVoter', (req, res) => {
  const { v_email, username, address, status } = req.body;

  // Basic input validation
  if (!v_email || !username || !address || !status) {
    return res.status(400).json({ error: 'All fields except dateOfBirth are required' });
  }

  // Query to update voter information without changing dateOfBirth
  const updateQuery = `
    UPDATE voter 
    SET username = ?, address = ?, status = ? 
    WHERE v_email = ?`;

  db.query(updateQuery, [username, address, status, v_email], (err, results) => {
    if (err) {
      console.error('Database query failed', err);  // Log the error for debugging
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    res.json({ success: true });
  });
});

// Delete voter record
app.post('/deleteVoter', (req, res) => {
  const { v_email } = req.body;

  const deleteQuery = 'DELETE FROM voter WHERE v_email = ?';

  db.query(deleteQuery, [v_email], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database query failed' });
      return;
    }
    res.json({ success: true });
  });
});


app.get("/candidatesWithPost", (req, res) => {
  const query = `
    SELECT 
    c.id,
    c.candidateName, 
    c.c_email, 
    GROUP_CONCAT(d.designationName) AS designations
FROM 
    candidate c
LEFT JOIN 
    designations d ON c.designationId = d.designationId
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
app.delete("/elections/:electionId", (req, res) => {
  const electionId = req.params.electionId;
  const query = "DELETE FROM elections WHERE electionId = ?";
  
  db.query(query, [electionId], (err, result) => {
    if (err) {
      console.error("Error deleting election:", err);
      return res.status(500).send("Server error");
    }
    res.sendStatus(204); // No content to send back
  });
});

// Update candidate
app.post("/updateCandidate", (req, res) => {
  const { id, candidateName, c_email } = req.body;
  const query = `
      UPDATE candidate 
      SET candidateName = ?, c_email = ? 
      WHERE id = ?;
  `;
  db.query(query, [candidateName, c_email, id], (err, results) => {
      if (err) {
          console.error("Error updating candidate:", err);
          return res.status(500).json({ error: "Failed to update candidate." });
      }
      res.json({ id, candidateName, c_email });
  });
});

// Delete candidate
app.post("/deleteCandidate", (req, res) => {
  const { id } = req.body;

  console.log("Received data for delete: ", { id }); // Add logging

  const query = "DELETE FROM candidate WHERE id = ?";

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error deleting candidate:", err);
      return res.status(500).send(err); // Log the error
    }
    console.log("Delete successful:", result); // Log success
    res.json({ success: true });
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});