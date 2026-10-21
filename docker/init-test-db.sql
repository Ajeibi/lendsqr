-- Separate database for the e2e suite so tests never touch dev data.
CREATE DATABASE wallet_test OWNER wallet;
