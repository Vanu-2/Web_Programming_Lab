const multer = require("multer");
const fs = require("fs");
const csvParser = require("csv-parser");
const db = require("./server"); // Assume the database connection is in a separate file called dbConnection.js

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

// Function to handle file uploads by admin
const modifyVoterInfo = (app) => {
  app.post(
    "/admin/modify_voter_info",
    upload.single("voterData"),
    (req, res) => {
      const filePath = req.file.path;

      // Parse the CSV file
      const voters = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (row) => {
          voters.push({
            username: row.username,
            email: row.email,
            dateOfBirth: row.dateOfBirth,
            address: row.address,
            password: row.password,
          });
        })
        .on("end", () => {
          // Insert voter data into the database
          const query =
            "INSERT INTO voter (username, email, dateOfBirth, address, password) VALUES (?,?,?,?,?)";
          voters.forEach((voter) => {
            db.query(
              query,
              [
                voter.username,
                voter.email,
                voter.dateOfBirth,
                voter.address,
                voter.password,
              ],
              (err, result) => {
                if (err) {
                  console.error("Error inserting data into the database:", err);
                }
              }
            );
          });
          res.send("File uploaded and voter data saved successfully!");
        });
    }
  );
};

module.exports = modifyVoterInfo;


