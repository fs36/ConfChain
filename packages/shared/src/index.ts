export type UserRole = "ADMIN" | "AUTHOR" | "REVIEWER";

export interface CopyrightCertificate {
  txHash: string;
  blockHeight: number;
  fileHash: string;
  timestamp: number;
}

export interface ReviewDecision {
  paperId: string;
  averageScore: number;
  threshold: number;
  finalStatus: "ACCEPTED" | "REVISION" | "REJECTED";
}
