import { useRef, useState } from 'react'
import BackButton from '../components/BackButton'
import UsageBadge from '../components/UsageBadge'
import { QRCodeCanvas } from 'qrcode.react'

export default function QrGenerator() {
    const [url, setUrl] = useState('')
    const [message, setMessage] = useState('')
    const canvasRef = useRef(null)

    const handleDownload = () => {
        const node = canvasRef.current
        if (!node) return
        const canvas = node.querySelector('canvas')
        if (!canvas) return

        const urlData = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = urlData
        link.download = 'shortly-qr.png'
        link.click()
        setMessage('QR code downloaded.')
    }

    return (
        <section className="page-content">
            <BackButton />
            <header className="page-header">
                <div>
                    <h2>QR Generator</h2>
                    <p>Generate a QR code for any shortened URL.</p>
                </div>
                <UsageBadge count={3} />
            </header>
            <div className="feature-form">
                <label>
                    Short URL
                    <input
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        type="url"
                        placeholder="https://short.ly/product"
                    />
                </label>
                <div className="qr-output" ref={canvasRef}>
                    {url ? (
                        <QRCodeCanvas value={url} size={210} level="H" />
                    ) : (
                        <p>Enter a link to generate a QR code.</p>
                    )}
                </div>
                <div className="button-row">
                    <button type="button" disabled={!url} onClick={handleDownload}>
                        Download QR
                    </button>
                </div>
                {message && <div className="message-box">{message}</div>}
            </div>
        </section>
    )
}
