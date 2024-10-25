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

// Start login page backend
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Check if user is a voter
  const voterQuery = "SELECT * FROM voter WHERE email = ? AND password = ?";
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
    const candidateQuery = "SELECT * FROM candidate WHERE email = ? AND password = ?";
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
// End of login page backend

// Endpoint to handle file uploads
// Serve static files from the admin folder
app.use(express.static(__dirname + "/admin"));

// Fetch candidate name and email from the database

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

modifyVoterInfo(app);

// Fetch the candidate name and position from database
app.get("/api/candidate", (req, res) => {
  const query = "SELECT candidateName, position, symbol FROM candidate";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching candidate data:", err);
      res.status(500).send("Server error");
      return;
    }
    res.json(results); // Send the fetched data as JSON response
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
  const query = "SELECT username, email, dateOfBirth, address FROM voter"; 
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
