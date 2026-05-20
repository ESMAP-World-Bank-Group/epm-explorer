import { Link, useParams, useLocation } from 'react-router-dom'
import { useModel } from '../hooks/useGitHub'

function BranchLabel({ branch }) {
  const { model } = useModel(branch)
  return <span className="navbar-sub">{model?.name || branch}</span>
}

export default function Navbar() {
  const { pathname } = useLocation()
  const { branch } = useParams()
  const isWorld = pathname === '/'

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">EPM Explorer</Link>
      {!isWorld && branch && (
        <>
          <span className="navbar-divider">/</span>
          <BranchLabel branch={branch} />
        </>
      )}
      {!isWorld && (
        <Link to="/" className="navbar-back">← All models</Link>
      )}
    </nav>
  )
}
