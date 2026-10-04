import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LegalLayout({ title, updated, children }) {
  const { user } = useAuth();
  return (
    <div className="min-h-full bg-ink-900">
      <header className="border-b border-line bg-ink-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to={user ? '/dashboard' : '/login'} className="flex items-center gap-2 text-sm text-muted hover:text-fg hover:no-underline">
            <ArrowLeft size={15} /> {user ? 'Back to the app' : 'Back to sign in'}
          </Link>
          <span className="text-sm font-semibold text-fg">RapidResQ</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-8 text-sm leading-6 text-fg">{children}</div>
        <nav className="mt-12 flex gap-6 border-t border-line pt-6 text-sm">
          <Link to="/terms">Terms and Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
      </main>
    </div>
  );
}

export const Section = ({ heading, children }) => (
  <section>
    <h2 className="mb-2 text-lg">{heading}</h2>
    <div className="space-y-3 text-muted">{children}</div>
  </section>
);

export function Terms() {
  return (
    <LegalLayout title="Terms and Conditions" updated="2 October 2026">
      <Section heading="1. What this application is">
        <p>
          RapidResQ is a simulation of pre-hospital emergency response. It was built as a college Data Structures course project to demonstrate graphs, priority queues, heaps, hash tables, stacks, queues, breadth-first search and Dijkstra's algorithm.
          By signing in you agree to these terms.
        </p>
      </Section>
      <Section heading="2. Not for real emergencies">
        <p>
          RapidResQ must not be used to dispatch real vehicles, route real ambulances, make medical decisions or replace any emergency service. Travel times, routes, hospital choices and statistics are produced by a simplified model on fictional data and do not describe real roads, hospitals or patients.
        </p>
        <p>If you are facing a real emergency, contact your local emergency number immediately.</p>
      </Section>
      <Section heading="3. Accounts">
        <p>
          Access is limited to two roles. Administrators manage ambulances, hospitals, the road graph, traffic, history and analytics. Dispatchers report emergencies, dispatch ambulances and manage active missions.
        </p>
        <p>
          Keep your credentials private and change the seeded demo passwords before sharing an installation. You are responsible for activity under your account. Do not attempt to access features or data outside your role, or to interfere with the service or other users.
        </p>
      </Section>
      <Section heading="4. Acceptable use">
        <p>Use only fictional information in descriptions and other free-text fields. Do not enter real names, addresses, health details or any other personal data. Do not upload or submit unlawful, harmful or offensive content.</p>
      </Section>
      <Section heading="5. Fictional data">
        <p>The map uses the names and positions of real Chennai localities and hospitals, but the road links, travel times, ambulance stations, bed counts, specialties, ambulances, emergencies and users are fictional. Any resemblance to real incidents is coincidental.</p>
      </Section>
      <Section heading="6. Map and contact data">
        <p>The base map uses CARTO Voyager tiles drawn from OpenStreetMap data. Map data is copyright OpenStreetMap contributors, available under the Open Database Licence; tiles are by CARTO. Helpline and hospital numbers in the Resources page are taken from public sources and can be out of date. Confirm a number with the organisation before relying on it.</p>
      </Section>
      <Section heading="7. No warranty">
        <p>
          The application is provided as is, without warranties of any kind, including accuracy, availability or fitness for a particular purpose. It may contain errors and may change or stop working without notice.
        </p>
      </Section>
      <Section heading="8. Limitation of liability">
        <p>
          To the extent permitted by law, the project team and the institution are not liable for any loss or damage arising from use of, or inability to use, the application.
        </p>
      </Section>
      <Section heading="9. Software and licences">
        <p>The application relies on open-source libraries, each under its own licence. The algorithms and data structures were implemented by the project team without a black-box routing library.</p>
      </Section>
      <Section heading="10. Changes to these terms">
        <p>These terms may be updated as the project evolves. The date at the top shows the latest revision. Continued use after a change means you accept the updated terms.</p>
      </Section>
      <Section heading="11. Contact">
        <p>Questions about these terms can be directed to the course instructor or the project team through your institution.</p>
      </Section>
    </LegalLayout>
  );
}

export function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="2 October 2026">
      <Section heading="Summary">
        <p>
          RapidResQ stores only what it needs to run the simulation: sign-in accounts and the simulated operational records. It sets no tracking cookies, loads no third-party scripts or fonts, and sends no data to outside services. The one exception is the base map: your browser downloads map tiles from CARTO (basemaps.cartocdn.com), which can see your IP address and browser details as any website would.
        </p>
      </Section>
      <Section heading="What is stored">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Account details: username, full name, role, a bcrypt hash of the password (never the password itself) and the time of the last sign-in.</li>
          <li>Simulation records: emergencies, missions, ambulance and hospital data, road and traffic changes, and any description text you type.</li>
          <li>Audit fields: the username of the person who reported an emergency, dispatched a mission or changed traffic is saved with that record.</li>
          <li>Technical records: the server may log errors and request paths to help fix problems. Request bodies and passwords are not logged.</li>
        </ul>
      </Section>
      <Section heading="Sessions and browser storage">
        <p>
          After you sign in, a signed session token is kept in your browser's session storage for up to eight hours. It is removed when you sign out or close the tab. The application does not use cookies. Signing out also revokes the token on the server.
        </p>
      </Section>
      <Section heading="Where the data lives">
        <p>Data is kept in a SQLite database file on the computer that runs the server. It is not transferred to any other service, apart from the map tile requests described above. Whoever operates that computer can access the file, so treat the installation as you would any shared coursework system.</p>
      </Section>
      <Section heading="Please do not enter real personal data">
        <p>The application is not designed to hold real personal or health information. Use fictional details only. If real data is entered by mistake, ask an administrator to remove it.</p>
      </Section>
      <Section heading="Retention and deletion">
        <p>
          Records stay until they are removed. Administrators can reset all simulation data from Settings, which keeps user accounts. Deleting the database file removes everything, including accounts.
        </p>
      </Section>
      <Section heading="Security measures">
        <p>
          Passwords are hashed, sessions are signed and expire, access is restricted by role, sign-in attempts are rate limited and the server sends standard security headers. No system is perfectly secure, so avoid reusing a password from another service.
        </p>
      </Section>
      <Section heading="Your choices">
        <p>You can change your password in Settings. To see, correct or delete information held about you, contact the administrator of your installation.</p>
      </Section>
      <Section heading="Children">
        <p>The application is intended for students and instructors and is not directed at children.</p>
      </Section>
      <Section heading="Changes and contact">
        <p>This policy may be updated as the project changes, and the date above will change with it. For questions, contact the course instructor or the project team through your institution.</p>
      </Section>
    </LegalLayout>
  );
}
