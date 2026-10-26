/**
 * Vendor SDK packages → the external service they talk to, and the constructor
 * shape that marks a call site. Data, not code: a new vendor is a new row.
 *
 * `pkg` matches a manifest dependency name exactly, or as a prefix when it ends
 * in `*`. `ctor` is matched against source lines of the ecosystem's languages.
 */
export interface SdkRow {
    ecosystem: 'composer' | 'npm' | 'pypi' | 'go';
    pkg: string;
    service: string;
    ctor: string;
}

export const SDK_TABLE: readonly SdkRow[] = [
    { ecosystem: 'composer', pkg: 'stripe/stripe-php', service: 'stripe', ctor: String.raw`new\s+\\?Stripe\\StripeClient\s*\(|\bStripe::setApiKey\s*\(` },
    { ecosystem: 'composer', pkg: 'aws/aws-sdk-php', service: 'aws', ctor: String.raw`new\s+\\?(?:Aws\\[\w\\]*\\)?(\w+Client)\s*\(|new\s+\\?Aws\\Sdk\s*\(` },
    { ecosystem: 'composer', pkg: 'twilio/sdk', service: 'twilio', ctor: String.raw`new\s+\\?Twilio\\Rest\\Client\s*\(` },
    { ecosystem: 'composer', pkg: 'sendgrid/sendgrid', service: 'sendgrid', ctor: String.raw`new\s+\\?SendGrid\s*\(` },
    { ecosystem: 'composer', pkg: 'mailgun/mailgun-php', service: 'mailgun', ctor: String.raw`\bMailgun::create\s*\(` },
    { ecosystem: 'composer', pkg: 'openai-php/client', service: 'openai', ctor: String.raw`\bOpenAI::(?:client|factory)\s*\(` },
    { ecosystem: 'composer', pkg: 'google/apiclient', service: 'google', ctor: String.raw`new\s+\\?Google(?:\\|_)Client\s*\(` },
    { ecosystem: 'npm', pkg: 'stripe', service: 'stripe', ctor: String.raw`new\s+Stripe\s*\(|\bStripe\s*\(\s*process\.env` },
    { ecosystem: 'npm', pkg: '@aws-sdk/*', service: 'aws', ctor: String.raw`new\s+(\w+Client)\s*\(` },
    { ecosystem: 'npm', pkg: 'aws-sdk', service: 'aws', ctor: String.raw`new\s+AWS\.(\w+)\s*\(` },
    { ecosystem: 'npm', pkg: 'twilio', service: 'twilio', ctor: String.raw`\btwilio\s*\(|new\s+Twilio\s*\(` },
    { ecosystem: 'npm', pkg: '@sendgrid/mail', service: 'sendgrid', ctor: String.raw`\.setApiKey\s*\(` },
    { ecosystem: 'npm', pkg: 'openai', service: 'openai', ctor: String.raw`new\s+OpenAI\s*\(` },
    { ecosystem: 'npm', pkg: '@anthropic-ai/sdk', service: 'anthropic', ctor: String.raw`new\s+Anthropic\s*\(` },
    { ecosystem: 'npm', pkg: '@slack/web-api', service: 'slack', ctor: String.raw`new\s+WebClient\s*\(` },
    { ecosystem: 'npm', pkg: 'firebase-admin', service: 'firebase', ctor: String.raw`\binitializeApp\s*\(` },
    { ecosystem: 'pypi', pkg: 'stripe', service: 'stripe', ctor: String.raw`\bstripe\.api_key\s*=|\bStripeClient\s*\(` },
    { ecosystem: 'pypi', pkg: 'boto3', service: 'aws', ctor: String.raw`\bboto3\.(?:client|resource)\s*\(\s*['"](\w+)` },
    { ecosystem: 'pypi', pkg: 'twilio', service: 'twilio', ctor: String.raw`\bClient\s*\(` },
    { ecosystem: 'pypi', pkg: 'openai', service: 'openai', ctor: String.raw`\b(?:Async)?OpenAI\s*\(` },
    { ecosystem: 'pypi', pkg: 'anthropic', service: 'anthropic', ctor: String.raw`\b(?:Async)?Anthropic\s*\(` },
    { ecosystem: 'pypi', pkg: 'slack_sdk', service: 'slack', ctor: String.raw`\bWebClient\s*\(` },
    { ecosystem: 'pypi', pkg: 'sendgrid', service: 'sendgrid', ctor: String.raw`\bSendGridAPIClient\s*\(` },
    { ecosystem: 'go', pkg: 'github.com/stripe/stripe-go*', service: 'stripe', ctor: String.raw`\bstripe\.Key\s*=|\bclient\.New\s*\(` },
    { ecosystem: 'go', pkg: 'github.com/aws/aws-sdk-go-v2*', service: 'aws', ctor: String.raw`\b(\w+)\.NewFromConfig\s*\(` },
    { ecosystem: 'go', pkg: 'github.com/twilio/twilio-go', service: 'twilio', ctor: String.raw`\btwilio\.NewRestClient\w*\s*\(` },
    { ecosystem: 'go', pkg: 'github.com/sashabaranov/go-openai', service: 'openai', ctor: String.raw`\bopenai\.NewClient\w*\s*\(` },
    { ecosystem: 'go', pkg: 'github.com/slack-go/slack', service: 'slack', ctor: String.raw`\bslack\.New\s*\(` },
];

export const ECOSYSTEM_LANGS: Record<SdkRow['ecosystem'], readonly string[]> = {
    composer: ['php'],
    npm: ['js'],
    pypi: ['python'],
    go: ['go'],
};

export function rowMatches(row: SdkRow, dep: string): boolean {
    return row.pkg.endsWith('*') ? dep.startsWith(row.pkg.slice(0, -1)) : dep === row.pkg;
}
