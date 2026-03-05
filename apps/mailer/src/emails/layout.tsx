import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Tailwind,
  Text,
} from "@react-email/components";

function UnsubscribeFooter({ url }: { url: string }) {
  return (
    <>
      <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        <Link href={url} className="text-[#666666] underline">
          通知を解除する
        </Link>
      </Text>
    </>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

export function Layout({ children, unsubscribeUrl }: LayoutProps) {
  return (
    <Html lang="ja">
      <Head />
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            {children}
            {unsubscribeUrl && <UnsubscribeFooter url={unsubscribeUrl} />}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
