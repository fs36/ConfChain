// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/**
 * ConfChainCore - 版权存证与审稿核心合约
 *
 * 功能：
 *  1. submitCopyright  - 登记文件哈希与元数据哈希，防篡改版权证明
 *  2. getCopyright     - 查询存证记录
 *  3. submitReview     - 记录匿名审稿意见（评分+建议+意见哈希）
 *  4. getReviews       - 查询稿件所有审稿意见
 *  5. finalizeDecision - 写入最终裁定结论
 *  6. getDecision      - 查询裁定结论
 *
 * 部署方式：通过 WeBASE-Front 控制台 或 Hardhat 脚本部署至 FISCO BCOS
 */
contract ConfChainCore {
    // ---------- 数据结构 ----------

    struct CopyrightRecord {
        string  fileHash;       // SHA-256 文件哈希
        address author;         // 作者钱包地址
        uint256 timestamp;      // 存证时间（Unix ms）
        bytes32 metadataHash;   // 标题+摘要+关键词 SHA-256
        bool    exists;
    }

    struct ReviewRecord {
        uint8   score;           // 评分 0-100
        string  recommendation;  // STRONG_ACCEPT / ACCEPT / WEAK_ACCEPT / REJECT
        bytes32 commentHash;     // 评语 SHA-256（匿名保护）
        address reviewer;        // 审稿人钱包地址
        uint256 timestamp;
    }

    // ---------- 状态变量 ----------

    address public owner;

    /// fileHash => CopyrightRecord
    mapping(string => CopyrightRecord) private records;

    /// paperId => ReviewRecord[]
    mapping(string => ReviewRecord[]) private reviewResults;

    /// paperId => 最终裁定结论
    mapping(string => string) private finalDecision;

    /// paperId => 裁定时间
    mapping(string => uint256) private decisionTimestamp;

    // ---------- 事件 ----------

    event CopyrightSubmitted(
        string  indexed fileHash,
        address indexed author,
        uint256 timestamp,
        bytes32 metadataHash
    );

    event ReviewSubmitted(
        string  indexed paperId,
        address indexed reviewer,
        uint8   score,
        string  recommendation
    );

    event DecisionFinalized(
        string indexed paperId,
        string decision,
        uint256 timestamp
    );

    // ---------- 访问控制 ----------

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---------- 写入函数 ----------

    /**
     * 版权存证
     * @param fileHash     文件 SHA-256（64 位十六进制）
     * @param author       作者钱包地址
     * @param timestamp    存证时间（Unix 毫秒）
     * @param metadataHash 元数据 SHA-256
     */
    function submitCopyright(
        string calldata fileHash,
        address author,
        uint256 timestamp,
        bytes32 metadataHash
    ) external onlyOwner {
        require(!records[fileHash].exists, "already certified");
        records[fileHash] = CopyrightRecord(fileHash, author, timestamp, metadataHash, true);
        emit CopyrightSubmitted(fileHash, author, timestamp, metadataHash);
    }

    /**
     * 提交审稿意见
     * @param paperId       稿件业务 ID
     * @param reviewer      审稿人钱包地址
     * @param score         综合评分（0-100）
     * @param recommendation 录用建议
     * @param commentHash   评语 SHA-256
     */
    function submitReview(
        string calldata paperId,
        address reviewer,
        uint8 score,
        string calldata recommendation,
        bytes32 commentHash
    ) external onlyOwner {
        require(score <= 100, "invalid score");
        reviewResults[paperId].push(
            ReviewRecord(score, recommendation, commentHash, reviewer, block.timestamp)
        );
        emit ReviewSubmitted(paperId, reviewer, score, recommendation);
    }

    /**
     * 写入最终裁定结论
     * @param paperId  稿件业务 ID
     * @param decision ACCEPTED / REVISION / REJECTED
     */
    function finalizeDecision(
        string calldata paperId,
        string calldata decision
    ) external onlyOwner {
        finalDecision[paperId] = decision;
        decisionTimestamp[paperId] = block.timestamp;
        emit DecisionFinalized(paperId, decision, block.timestamp);
    }

    // ---------- 查询函数 ----------

    function getCopyright(string calldata fileHash)
        external
        view
        returns (address author, uint256 timestamp, bytes32 metadataHash, bool exists)
    {
        CopyrightRecord storage r = records[fileHash];
        return (r.author, r.timestamp, r.metadataHash, r.exists);
    }

    function getReviewCount(string calldata paperId)
        external
        view
        returns (uint256)
    {
        return reviewResults[paperId].length;
    }

    function getReview(string calldata paperId, uint256 index)
        external
        view
        returns (
            uint8 score,
            string memory recommendation,
            bytes32 commentHash,
            address reviewer,
            uint256 timestamp
        )
    {
        ReviewRecord storage r = reviewResults[paperId][index];
        return (r.score, r.recommendation, r.commentHash, r.reviewer, r.timestamp);
    }

    function getDecision(string calldata paperId)
        external
        view
        returns (string memory decision, uint256 timestamp)
    {
        return (finalDecision[paperId], decisionTimestamp[paperId]);
    }
}
