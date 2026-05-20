import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import WorldPage from './pages/WorldPage'
import ModelPage from './pages/ModelPage'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<WorldPage />} />
        <Route path="/model/:branch" element={<ModelPage />} />
      </Routes>
    </>
  )
}
