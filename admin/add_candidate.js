const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// Set up middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure multer for file uploads (store symbol images in 'uploads' folder)
const upload = multer({ dest: "uploads/" });
app.get("/getDesignations", (req, res) => {
    db.query("SELECT designationName, name FROM designations", (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to get elections
app.get("/getElections", (req, res) => {
    db.query("SELECT electionName, name FROM elections", (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Endpoint to add a candidate
app.post("/addCandidate", upload.single("symbol"), (req, res) => {
    const { candidateName, c_email, password, designationId, electionId } = req.body;
    const symbol = fs.readFileSync(req.file.path); // Read the uploaded image file
    const sql = `
        INSERT INTO candidate (candidateName, c_email, password, symbol, electionId, designationId)
        VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [candidateName, c_email, password, symbol, electionId, designationId], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Failed to add candidate" });
        } else {
            res.json({ success: true, message: "Candidate added successfully" });
        }
    });
});
