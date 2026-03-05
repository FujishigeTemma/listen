import {
  Button,
  Heading,
  Preview,
  Text,
} from "@react-email/components";
import { Layout } from "./layout.tsx";

interface VerificationEmailProps {
  verifyUrl: string;
}

export const verificationSubject = "通知の登録を確認してください";

export function VerificationEmail({ verifyUrl }: VerificationEmailProps) {
  return (
    <Layout>
      <Preview>{verificationSubject}</Preview>
      <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
        {verificationSubject}
      </Heading>
      <Text className="text-black text-[14px] leading-[24px]">
        以下のリンクをクリックして、通知の登録を確認してください。
      </Text>
      <Button
        className="box-border bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-[20px] py-[12px]"
        href={verifyUrl}
      >
        登録を確認する
      </Button>
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        このリンクの有効期限は30分です。
      </Text>
    </Layout>
  );
}
