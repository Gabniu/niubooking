// Ownership: public product narrative for prospects; no organization data belongs here.
import { BookingIllustration } from "./booking-illustration.js";

const capabilities = ["Appointments", "Classes", "Trips", "QR booking", "Feedback"];

function CalendarMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>;
}

export function PublicHome() {
  return <>
    <header className="public-header">
      <div className="public-header-top">
        <a className="public-brand" href="/" aria-label="Niu Booking home"><span className="public-brand-mark"><CalendarMark /></span><span className="public-brand-wordmark"><span>Niu</span> <strong>Booking</strong></span></a>
        <div className="public-header-actions"><span className="public-audience">For service businesses</span><a className="public-sign-in" href="/auth/sign-in">Sign in</a></div>
      </div>
      <nav className="public-nav" aria-label="Niu Booking capabilities">{capabilities.map((item, index) => <a className={`public-nav-item${index === 0 ? " active" : ""}`} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>{item}</a>)}</nav>
    </header>
    <main className="public-main">
      <section className="public-hero" id="appointments">
        <div className="public-hero-copy"><p className="public-eyebrow">SERVICE OPERATIONS, WITHOUT THE NOISE</p><h1>Make every booking feel easy to keep.</h1><p className="public-lede">Niu Booking gives appointments, classes, trips, resources, reminders, and feedback one calm, dependable home.</p><div className="public-actions"><a className="public-primary" href="/auth/sign-in">Start with Booking <span aria-hidden="true">→</span></a><a className="public-secondary" href="#model">See how it works</a></div><p className="public-trust">Built for dental and medical teams, driving schools, fitness, education, professional services, and transport.</p></div>
        <div className="public-hero-card"><p className="public-eyebrow">ONE SHARED MODEL</p><h2>Service. Reservation. Resources.</h2><p>Keep the universal booking engine consistent while your industry pack supplies the language and workflow your team knows.</p><BookingIllustration id="booking" alt="A booking workflow being arranged" className="public-hero-illustration" /><ol className="model-steps"><li><span>01</span><strong>Define the service</strong><small>Appointment, lesson, class, or trip.</small></li><li><span>02</span><strong>Find a feasible slot</strong><small>Match people, places, vehicles, and capacity.</small></li><li><span>03</span><strong>Keep the customer informed</strong><small>Confirm, remind, reschedule, and learn.</small></li></ol></div>
      </section>
      <section className="public-section" id="model"><div><p className="public-eyebrow">DESIGNED TO ADAPT</p><h2>One platform, different kinds of work.</h2></div><p>Start small with Booking. Add Voice operations when your team is ready. The same tenant-safe foundation keeps the experience coherent as the business grows.</p></section>
      <section className="public-category-grid" aria-label="Niu Booking use cases"><article id="classes"><p className="public-eyebrow">CLASSES</p><h2>Reserve a place</h2><p>Fitness, education, training, and group sessions with capacity and attendance in view.</p></article><article id="trips"><p className="public-eyebrow">TRIPS</p><h2>Find a departure</h2><p>Routes, runs, capacity, and passenger journeys with a clear path to live tracking.</p></article><article id="qr-booking"><p className="public-eyebrow">QR BOOKING</p><h2>Scan and start</h2><p>Put a safe, print-ready booking destination where customers already are.</p></article><article id="feedback"><p className="public-eyebrow">FEEDBACK</p><h2>Keep improving</h2><p>Invite conversational feedback after an appointment or whenever your organization chooses.</p></article></section>
      <section className="public-footer-cta"><div><p className="public-eyebrow">READY WHEN YOU ARE</p><h2>Give your team fewer things to chase.</h2></div><a className="public-primary" href="/auth/sign-in">Enter your workspace <span aria-hidden="true">→</span></a></section>
    </main>
  </>;
}
