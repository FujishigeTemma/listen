import {
  Button,
  Heading,
  Preview,
  Text,
} from "@react-email/components";
import { Layout } from "./layout.tsx";

interface NotificationEmailProps {
  eventType: "live_started" | "scheduled_created";
  sessionId: string;
  occurredAt: string;
  publicUrl: string;
  unsubscribeUrl: string;
}

const content = {
  live_started: {
    subject: "配信が開始しました",
    body: "配信が開始されました。",
    timeLabel: "開始時刻",
    cta: "視聴する",
    linkPath: (sessionId: string) => `/s/${sessionId}`,
  },
  scheduled_created: {
    subject: "新しい配信予定が登録されました",
    body: "新しい配信予定が登録されました。",
    timeLabel: "予定時刻",
    cta: "通知ページを開く",
    linkPath: () => "/notifications",
  },
} as const;

export function notificationSubject(eventType: "live_started" | "scheduled_created") {
  return content[eventType].subject;
}

export function NotificationEmail({
  eventType,
  sessionId,
  occurredAt,
  publicUrl,
  unsubscribeUrl,
}: NotificationEmailProps) {
  const c = content[eventType];
  const linkUrl = new URL(c.linkPath(sessionId), publicUrl).toString();

  return (
    <Layout unsubscribeUrl={unsubscribeUrl}>
      <Preview>{c.subject}</Preview>
      <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
        {c.subject}
      </Heading>
      <Text className="text-black text-[14px] leading-[24px]">
        {c.body}
      </Text>
      <Text className="text-black text-[14px] leading-[24px]">
        {c.timeLabel}: {occurredAt}
      </Text>
      <Button
        className="box-border bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-[20px] py-[12px]"
        href={linkUrl}
      >
        {c.cta}
      </Button>
    </Layout>
  );
}
