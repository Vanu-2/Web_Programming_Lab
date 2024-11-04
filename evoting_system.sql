-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 25, 2024 at 11:48 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- Database: `evoting_system`
-- --------------------------------------------------------

-- Table structure for `admin`
CREATE TABLE `admin` (
  `username` varchar(30) PRIMARY KEY NOT NULL,
  `email` varchar(20) NOT NULL,
  `password` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for table `admin`
INSERT INTO `admin` (`username`, `email`, `password`) VALUES
('Imam', 'imam@gmail.com', 'imam1');

-- Table structure for `candidate`
CREATE TABLE `candidate` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `candidateName` varchar(255) NOT NULL,
  `c_email` varchar(255) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `symbol` BLOB NOT NULL,
  `electionId` int(11) NOT NULL,
  `designationId` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`electionId`) REFERENCES `elections`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`designationId`) REFERENCES `designations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



-- Table structure for `designations`
CREATE TABLE `designations` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `designationName` varchar(255) NOT NULL,
  `electionId` int(11) NOT NULL,
  FOREIGN KEY (`electionId`) REFERENCES `elections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for table `designations`
INSERT INTO `designations` (`id`, `designationName`, `electionId`) VALUES
(1, 'ClassRepresentative', 1),
(2, 'AssistantClassRepresentative', 1),
(3, 'Chairman', 2),
(4, 'Union Member', 2),
(8, 'President', 4),
(9, 'Vice President 1', 4),
(10, 'Vice President 2', 4);

-- Table structure for `elections`
CREATE TABLE `elections` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `electionName` varchar(255) NOT NULL,
  `electionDate` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for table `elections`
INSERT INTO `elections` (`id`, `electionName`, `electionDate`) VALUES
(1, 'ClassroomElection', '2024-10-31'),
(2, 'Upazilla Election', '2024-10-31'),
(4, 'National Election', '2024-10-31');

-- Table structure for `voter`
CREATE TABLE `voter` (
  `username` varchar(50) NOT NULL,
  `v_email` varchar(30) PRIMARY KEY NOT NULL,
  `dateOfBirth` date NOT NULL,
  `address` varchar(100) NOT NULL,
  `password` varchar(15) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for table `voter`
INSERT INTO `voter` (`username`, `v_email`, `dateOfBirth`, `address`, `password`) VALUES
('abid', 'abid@gmail.com', '2024-10-10', 'khulna', '123'),
('Alice', 'alice@gmail.com', '2024-10-17', 'sydney', '123'),
('Anamul', 'anamul@gmail.com', '2001-10-11', 'meherpur', '123'),
('johndoe', 'john@example.com', '2010-01-12', '123 Main St', 'password123'),
('nick', 'nick@gmail.com', '2024-10-17', 'fury', '123'),
('Raz', 'raz@gmail.com', '2004-10-20', 'boyra,khulna', '123'),
('Red', 'red@gmail.com', '2004-10-14', 'boyra,khulna', '123'),
('rythm', 'rythm@gmail.com', '2003-10-01', 'puki road', '123');

-- Table structure for `vote`
CREATE TABLE `vote` (
  `vote_id` int(11) PRIMARY KEY AUTO_INCREMENT,
  `c_email` varchar(255) NOT NULL,
  `v_email` varchar(30) NOT NULL,
  FOREIGN KEY (`v_email`) REFERENCES `voter`(`v_email`),
  FOREIGN KEY (`c_email`) REFERENCES `candidate`(`c_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Indexes for table `admin`
ALTER TABLE `admin`
  ADD PRIMARY KEY (`username`);

-- Indexes and auto-increment for table `candidate`
ALTER TABLE `candidate`
  ADD PRIMARY KEY (`id`),
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- Indexes and auto-increment for table `designations`
ALTER TABLE `designations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- Indexes and auto-increment for table `elections`
ALTER TABLE `elections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- Indexes for table `voter`
ALTER TABLE `voter`
  ADD PRIMARY KEY (`v_email`);

-- Commit transaction
COMMIT;

-- Reset session variables
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
