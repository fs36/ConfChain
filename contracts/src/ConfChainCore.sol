// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ConfChainCore {
    struct CopyrightRecord {
        string fileHash;
        address author;
        uint256 timestamp;
        bytes32 metadataHash;
    }

    struct ReviewResult {
        uint8 score;
        string recommendation;
        bytes32 commentHash;
        address reviewer;
    }

    address public owner;
    mapping(string => CopyrightRecord) public records;
    mapping(string => ReviewResult[]) public reviewResults;
    mapping(string => string) public finalDecision;

    event CopyrightSubmitted(string indexed fileHash, address indexed author, uint256 timestamp);
    event ReviewSubmitted(string indexed paperId, address indexed reviewer, uint8 score, string recommendation);
    event DecisionFinalized(string indexed paperId, string decision);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function submitCopyright(
        string calldata fileHash,
        address author,
        uint256 timestamp,
        bytes32 metadataHash
    ) external onlyOwner {
        require(records[fileHash].timestamp == 0, "already exists");
        records[fileHash] = CopyrightRecord(fileHash, author, timestamp, metadataHash);
        emit CopyrightSubmitted(fileHash, author, timestamp);
    }

    function submitReview(
        string calldata paperId,
        address reviewer,
        uint8 score,
        string calldata recommendation,
        bytes32 commentHash
    ) external onlyOwner {
        require(score <= 100, "invalid score");
        reviewResults[paperId].push(ReviewResult(score, recommendation, commentHash, reviewer));
        emit ReviewSubmitted(paperId, reviewer, score, recommendation);
    }

    function finalizeDecision(string calldata paperId, string calldata decision) external onlyOwner {
        finalDecision[paperId] = decision;
        emit DecisionFinalized(paperId, decision);
    }
}
