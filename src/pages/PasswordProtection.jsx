import { useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import UsageBadge from '../components/UsageBadge'

const initialPasswords = [
    { id: 1, name: 'Launch promo', slug: 'promo2026', password: 'P@ssword1' },
    { id: 2, name: 'VIP invite', slug: 'vip-link', password: 'Secret2026' },
]

export default function PasswordProtection() {
    const [shortUrlSlug, setShortUrlSlug] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [savedUrls, setSavedUrls] = useState(initialPasswords)
    const [selectedId, setSelectedId] = useState(null)
    const [message, setMessage] = useState('')

    const selectedItem = useMemo(
        () => savedUrls.find((item) => item.id === selectedId) ?? null,
        [savedUrls, selectedId],
    )

    const handleSubmit = (event) => {
        event.preventDefault()
        if (!shortUrlSlug || !password || !name) {
            setMessage('Fill in the name, slug, and password.')
            return
        }

        const entry = {
            id: selectedItem ? selectedItem.id : Date.now(),
            name,
            slug: shortUrlSlug,
            password,
        }

        setSavedUrls((current) => {
            if (selectedItem) {
                return current.map((item) => (item.id === selectedItem.id ? entry : item))
            }
            return [entry, ...current]
        })
        setMessage(selectedItem ? 'Password rule updated.' : 'Password protection added.')
        setSelectedId(null)
        setShortUrlSlug('')
        setPassword('')
        setName('')
    }

    const handleEdit = (item) => {
        setSelectedId(item.id)
        setName(item.name)
        setShortUrlSlug(item.slug)
        setPassword(item.password)
        setMessage('Editing saved password protection entry.')
    }

    return (
        <section className="page-content">
            <BackButton />
            <header className="page-header">
                <div>
                    <h2>Password Protection</h2>
                    <p>Secure short links with a password and keep control over shared access.</p>
                </div>
                <UsageBadge count={savedUrls.length} />
            </header>
            <div className="dashboard-toolbar">
            <form className="feature-form" onSubmit={handleSubmit}>
                <label>
                    Protected link name
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        type="text"
                        placeholder="Campaign link"
                        required
                    />
                </label>
                <label>
                    Short URL slug
                    <input
                        value={shortUrlSlug}
                        onChange={(event) => setShortUrlSlug(event.target.value)}
                        type="text"
                        placeholder="promo2026"
                        required
                    />
                </label>
                <label>
                    Password
                    <input
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        type="password"
                        placeholder="••••••••"
                        required
                    />
                </label>
                <div className="button-row">
                    <button type="submit">{selectedItem ? 'Update protection' : 'Protect link'}</button>
                    {selectedItem && (
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                                setSelectedId(null)
                                setName('')
                                setShortUrlSlug('')
                                setPassword('')
                                setMessage('')
                            }}
                        >
                            Cancel edit
                        </button>
                    )}
                </div>
                {message && <div className="message-box">{message}</div>}
            </form>
            <div className="admin-table">
                <div className="admin-row admin-header">
                    <span>Name</span>
                    <span>Slug</span>
                    <span>Action</span>
                </div>
                {savedUrls.map((item) => (
                    <div key={item.id} className="admin-row">
                    <span>{ "*".repeat(item.name.length/2)}</span>
                       {/* <span>{item.name}</span> */}
                        <span>{item.slug}</span>
                        <button className="secondary-button" type="button" onClick={() => handleEdit(item)}>
                            Edit
                        </button>
                    </div>
                ))}
            </div>
            </div>
        </section>
    )
}
