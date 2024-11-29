module.exports = function (db) {
  const express = require("express");
  const router = express.Router();

  router.post("/create-election", (req, res) => {
    const { electionName, startDate, endDate, designations } = req.body;

    // Check if there is any ongoing election
    const currentDateTime = new Date().toISOString();
    const checkOngoingElectionsQuery = `
      SELECT * FROM elections WHERE endDate > ?`;

    db.query(checkOngoingElectionsQuery, [currentDateTime], (err, results) => {
      if (err) {
        console.error("Error checking ongoing elections:", err);
        return res.status(500).send("Error checking ongoing elections");
      }

      if (results.length > 0) {
        return res
          .status(400)
          .send("Cannot create a new election as there is an ongoing election");
      }

      // Insert the new election
      const insertElectionQuery = `INSERT INTO elections (electionName, startDate, endDate) VALUES (?, ?, ?)`;
      db.query(insertElectionQuery, [electionName, startDate, endDate], (err, result) => {
        if (err) {
          console.error("Error inserting election:", err);
          return res.status(500).send("Error creating election");
        }

        const electionId = result.insertId;

        const insertDesignationQuery = `
          INSERT INTO designations (designationName, maxPosition, electionId)
          VALUES ?`;
        const designationValues = designations.map(({ name, maxPosition }) => [
          name,
          maxPosition,
          electionId,
        ]);

        db.query(insertDesignationQuery, [designationValues], (err) => {
          if (err) {
            console.error("Error inserting designations:", err);
            return res.status(500).send("Error adding designations");
          }

          res.send("Election and designations created successfully");
        });
      });
    });
  });

  return router;
};
