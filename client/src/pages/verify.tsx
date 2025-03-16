import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useParams } from "wouter";
import { type Credential } from "@shared/schema";

interface VerificationResponse {
  verified: boolean;
  credential: Credential;
  blockchainProof: {
    transactionId: string;
    blockTime: number;
    slot: number;
  };
}

export default function Verify() {
  const { hash } = useParams();

  const { data, isLoading, error } = useQuery<VerificationResponse>({
    queryKey: [`/api/credentials/verify/${hash}`],
    enabled: !!hash,
  });

  if (!hash) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Credential Verification</h1>
          <p className="text-muted-foreground">
            Scan a QR code or enter a credential hash to verify its authenticity.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Verification Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-6 w-6" />
            Credential Verified
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Student ID</p>
            <p className="text-muted-foreground">{data.credential.studentId}</p>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Credential Type</p>
            <p className="text-muted-foreground">{data.credential.credentialType}</p>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Issue Date</p>
            <p className="text-muted-foreground">
              {new Date(data.credential.issuedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Blockchain Proof</p>
            <p className="text-muted-foreground break-all">
              Transaction ID: {data.blockchainProof.transactionId}
            </p>
            <p className="text-muted-foreground">
              Block Time: {new Date(data.blockchainProof.blockTime * 1000).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}