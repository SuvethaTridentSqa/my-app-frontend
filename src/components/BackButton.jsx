import { useNavigate } from 'react-router-dom'
import './BackButton.css'

export default function BackButton({ label = "Return to Dashboard" }) {
    const navigate = useNavigate()
    return (
        <button className="back-button" onClick={() => navigate('/')}>
            {label}
        </button>
    )
}
