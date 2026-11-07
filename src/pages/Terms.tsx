import type { ReactNode } from 'react'
import { Link } from 'react-router'

export const CONTACT_EMAIL = 'guardeded@gmail.com'

const Contact = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
    {CONTACT_EMAIL}
  </a>
)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>
}

/** Readable signed in or out, so the sign-up forms can link to it. */
export function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
      <Link to="/" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to Chat
      </Link>

      <h1 className="mt-6 mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Terms and privacy
      </h1>
      <p className="mb-8 text-sm text-zinc-500">Last updated 7 November 2026</p>

      <div className="space-y-8">
        <Section title="About">
          <p>
            Chat is a small personal hobby project hosted in the United Kingdom. It's free and provided as is. By
            creating an account or joining as a guest, you agree to these terms.
          </p>
          <p>
            Contact, reports and complaints: <Contact />
          </p>
        </Section>

        <Section title="Who can use it">
          <p>
            You must be <strong>18 or over</strong>.
          </p>
        </Section>

        <Section title="What's not allowed">
          <p>
            <strong>No sexual or pornographic content of any kind</strong>, including links to it.
          </p>
          <p>Don't post, send or link to anything illegal in the UK, including:</p>
          <List>
            <li>sexual content involving children, or anything that grooms or exploits a child</li>
            <li>threats, harassment, stalking or abuse</li>
            <li>hatred against people for their race, religion, sexuality, disability or gender identity</li>
            <li>terrorist content, or encouraging violence</li>
            <li>encouraging or assisting self-harm or suicide</li>
            <li>sharing or threatening to share intimate images of someone without their consent</li>
            <li>fraud, scams, or selling drugs, weapons or other illegal items</li>
          </List>
          <p>Spam and flooding aren't allowed either.</p>
        </Section>

        <Section title="How you're protected">
          <List>
            <li>
              <strong>Blocking:</strong> you can block anyone. Neither of you can message the other.
            </li>
            <li>
              <strong>Groups:</strong> owners, admins and mods can delete messages, and kick or ban members.
            </li>
            <li>
              <strong>Reporting:</strong> email <Contact /> with the person or group and what was said.
            </li>
            <li>
              <strong>Removal:</strong> illegal content is removed once we're aware of it. Accounts that break these
              rules may be deleted without warning. Where the law requires it, content is reported to the police or
              the National Crime Agency.
            </li>
          </List>
        </Section>

        <Section title="Complaints and appeals">
          <p>
            Email <Contact /> if you disagree with a removal or ban, think a report wasn't handled properly, or have
            any other concern about the service.
          </p>
        </Section>

        <Section title="Your data">
          <List>
            <li>
              <strong>Registered accounts:</strong> display name, email address and a hashed password. The password
              itself is never stored.
            </li>
            <li>
              <strong>Guests:</strong> display name only.
            </li>
            <li>
              <strong>Everyone:</strong> messages, friends, blocks, group memberships and online status.
            </li>
            <li>
              <strong>Where:</strong> a private server in the UK. Traffic passes through Cloudflare, which sees your
              IP address.
            </li>
            <li>
              <strong>Cookies:</strong> only the ones needed to keep you signed in. No tracking or advertising.
            </li>
            <li>Your data is never sold or shared, except where the law requires it.</li>
          </List>
        </Section>

        <Section title="When data is deleted">
          <List>
            <li>A deleted message has its text erased. Only a “message deleted” placeholder is kept.</li>
            <li>Guest accounts are deleted when you log out or your session expires.</li>
            <li>To delete a registered account, email us from the address you signed up with.</li>
            <li>
              When an account is deleted, its profile goes. Messages in conversations other people are still in
              stay, shown as from “Deleted user”. Ask if you want those removed too.
            </li>
            <li>Database backups may hold deleted data until they're replaced.</li>
          </List>
          <p>
            You can ask for a copy of your data, a correction, or for it to be erased, at <Contact />. If you're
            unhappy with how your data is handled, you can complain to the{' '}
            <a href="https://ico.org.uk" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Information Commissioner's Office
            </a>
            .
          </p>
        </Section>

        <Section title="No guarantees">
          <p>
            The service may change, go offline or close at any time, and data may be lost. Don't rely on it for
            anything important.
          </p>
        </Section>
      </div>
    </main>
  )
}
