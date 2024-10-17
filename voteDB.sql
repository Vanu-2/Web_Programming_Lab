CREATE DATABASE evoting_system;

USE evoting_system;

-- Table: Voter
CREATE TABLE Voter (
    voter_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    age INT CHECK (age >= 18),
    is_candidate BOOLEAN DEFAULT FALSE
);

-- Table: Admin
CREATE TABLE Admin (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL
);

-- Table: Election
CREATE TABLE Election (
    election_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    election_date DATE NOT NULL
);

-- Table: Post
CREATE TABLE Post (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    post_name VARCHAR(100) NOT NULL,
    election_id INT,
    FOREIGN KEY (election_id) REFERENCES Election(election_id)
);

-- Table: Candidate
CREATE TABLE Candidate (
    candidate_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    voter_id INT,
    post_id INT,
    FOREIGN KEY (voter_id) REFERENCES Voter(voter_id),
    FOREIGN KEY (post_id) REFERENCES Post(post_id)
);

-- Table: Vote
CREATE TABLE Vote (
    vote_id INT PRIMARY KEY AUTO_INCREMENT,
    voter_id INT,
    candidate_id INT,
    election_id INT,
    FOREIGN KEY (voter_id) REFERENCES Voter(voter_id),
    FOREIGN KEY (candidate_id) REFERENCES Candidate(candidate_id),
    FOREIGN KEY (election_id) REFERENCES Election(election_id)
);

-- Junction Table: CandidateElection (Many-to-Many Relation)
CREATE TABLE CandidateElection (
    candidate_id INT,
    election_id INT,
    PRIMARY KEY (candidate_id, election_id),
    FOREIGN KEY (candidate_id) REFERENCES Candidate(candidate_id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES Election(election_id) ON DELETE CASCADE
);

-- Sample Data Insertions

-- Inserting Voters
INSERT INTO Voter (name, email, password, address, age, is_candidate) 
VALUES ('Alice Brown', 'alice@example.com', 'password1', '123 Street', 35, TRUE),
       ('Bob Smith', 'bob@example.com', 'password2', '456 Avenue', 40, FALSE);

-- Inserting Admin
INSERT INTO Admin (username, password) 
VALUES ('admin', 'adminpassword');

-- Inserting Elections
INSERT INTO Election (name, election_date) 
VALUES ('Presidential Election 2024', '2024-11-08');

-- Inserting Posts
INSERT INTO Post (post_name, election_id) 
VALUES ('President', 1);

-- Inserting Candidates
INSERT INTO Candidate (email, password, position, symbol, voter_id, post_id) 
VALUES ('alice@example.com', 'password1', 'President', 'Star', 1, 1);

-- Inserting Votes
INSERT INTO Vote (voter_id, candidate_id, election_id) 
VALUES (2, 1, 1);

-- Relating Candidate to Election (Many-to-Many)
INSERT INTO CandidateElection (candidate_id, election_id) 
VALUES (1, 1);
