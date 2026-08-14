import BackButton from '../components/BackButton'
import UsageBadge from '../components/UsageBadge'

export default function Expiration() {
    return (
        <section className="page-content">
            <BackButton />
            <header className="page-header">
                <div>
                    <h2>Expiration</h2>
                    <p>Set an expiry date for your short links.</p>
                </div>
                <UsageBadge count={5} />
            </header>
            <form className="feature-form">
                <label>
                    Short URL slug
                    <input type="text" placeholder="event-ticket" />
                </label>
                <label>
                    Expiration date/time
                    <input type="datetime-local" />
                </label>
                <button type="submit">Set expiration</button>
            </form>
        </section>
    )
}
