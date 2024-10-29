const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const multer = require("multer");
const fs = require("fs");
const csvParser = require("csv-parser"); // Install this package for parsing CSV files

const modifyVoterInfo = require("./voter_information");

const app = express();
const port = 3000;

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

// Handle signup form submission
app.post("/registration_form", (req, res) => {
  const { username, email, dateOfBirth, address, password } = req.body;

  // Insert user data into the database
  const query =
    "INSERT INTO voter (username, email, dateOfBirth, address, password) VALUES (?, ?, ?, ?, ?)";
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

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Check if user is a voter
  const voterQuery = "SELECT * FROM voter WHERE email = ? AND password = ?";
  db.query(voterQuery, [email, password], (err, voterResults) => {
    if (err) {
      console.error("Error querying the database for voter:", err);
      res.status(500).send("Server error");
      return;
    }

    if (voterResults.length > 0) {
      // Voter exists, redirect to voter dashboard
      return res.redirect("/voter/voter_dashboard.html");
    }

    // Check if user is a candidate
    const candidateQuery =
      "SELECT * FROM candidate WHERE email = ? AND password = ?";
    db.query(candidateQuery, [email, password], (err, candidateResults) => {
      if (err) {
        console.error("Error querying the database for candidate:", err);
        res.status(500).send("Server error");
        return;
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
          res.status(500).send("Server error");
          return;
        }

        if (adminResults.length > 0) {
          // Admin exists, redirect to admin dashboard
          return res.redirect("/admin/admin_dashboard.html");
        }

        // If no match found, user is not found in any table
        res
          .status(401)
          .send(
            'Invalid username or password. Try again or <a href="signup.html">Sign Up</a>.'
          );
      });
    });
  });
});

// Endpoint to handle file uploads
// Serve static files from the admin folder
app.use(express.static(__dirname + "/admin"));

// Fetch candidate name and email from the database
app.get("/candidate", (req, res) => {
  const query = "SELECT candidateName, email,designationld FROM candidate"; // Fetch only name and email

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching candidate data:", err);
      res.status(500).send("Server error");
      return;
    }

    // Send the candidate data as JSON
    res.json(results);
  });
});

// Endpoint to handle vote submission
app.post("/submitVote", (req, res) => {
  const { president, vicePresident } = req.body;

  // Update vote count for president
  const updatePresidentQuery =
    "UPDATE candidate SET votes = votes + 1 WHERE candidateName = ?";
  db.query(updatePresidentQuery, [president], (err, result) => {
    if (err) {
      console.error("Error updating president vote count:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    // Update vote count for vice president
    const updateVicePresidentQuery =
      "UPDATE candidate SET votes = votes + 1 WHERE candidateName = ?";
    db.query(updateVicePresidentQuery, [vicePresident], (err, result) => {
      if (err) {
        console.error("Error updating vice president vote count:", err);
        return res
          .status(500)
          .json({ success: false, message: "Server error" });
      }

      // If both updates succeed, send success response
      res.json({ success: true, message: "Vote submitted successfully!" });
    });
  });
});

app.get("/admin", (req, res) => {
  const sql = "SELECT candidateName, email, designationld FROM candidate";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching candidates:", err);
      res.status(500).json({ error: "Failed to retrieve candidates" });
      return;
    }
    res.json(results);
  });
});


modifyVoterInfo(app);

//fetch the candidate name position from database
app.get("/api/candidate", (req, res) => {
  const query = "SELECT candidateName, designationid, symbol FROM candidate";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching candidate data:", err);
      res.status(500).send("Server error");
      return;
    }
    res.json(results); // Send the fetched data as JSON response
  });
});

// Assuming Express.js for Node
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
// Assuming Express.js for Node
app.get('/api/voterCount', (req, res) => {
  const query = 'SELECT COUNT(*) as count FROM voter'; // Adjust according to your table structure
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
  const query = "SELECT username, email, address FROM voter";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching voter data:", err);
      return res.status(500).send("Server error");
    }
    res.json(results);
  });
});

app.get("/candidate", (req, res) => {
  const sql = "SELECT candidateName, email, designationld FROM candidate";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching candidates:", err);
      res.status(500).json({ error: "Failed to retrieve candidate" });
      return;
    }
    res.json(results);
  });

});

app.get("/admin", (req, res) => {
  const sql = "SELECT candidateName, email, designationld FROM candidate";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching candidates:", err);
      res.status(500).json({ error: "Failed to retrieve candidates" });
      return;
    }
    res.json(results);
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
