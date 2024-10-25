module.exports = function (db) {
  const express = require("express");
  const router = express.Router();

  router.post("/create-election", (req, res) => {
    const { electionName, electionDate, designations } = req.body;

    const insertElectionQuery = `INSERT INTO elections (electionName, electionDate) VALUES (?, ?)`;
    db.query(
      insertElectionQuery,
      [electionName, electionDate],
      (err, result) => {
        if (err) {
          console.error("Error inserting election:", err);
          return res.status(500).send("Error creating election");
        }

        const electionId = result.insertId;

        const insertDesignationQuery = `INSERT INTO designations (designationName, electionId) VALUES ?`;
        const designationValues = designations.map((designation) => [
          designation,
          electionId,
        ]);

        db.query(insertDesignationQuery, [designationValues], (err, result) => {
          if (err) {
            console.error("Error inserting designations:", err);
            return res.status(500).send("Error adding designations");
          }

          res.send("Election and designations created successfully");
        });
      }
    );
  });

  return router;
};
