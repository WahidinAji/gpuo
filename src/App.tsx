import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CreateTaskPage } from './pages/CreateTaskPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { Layout } from './components/Layout'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create-task" element={<CreateTaskPage />} />
        <Route path="/task/:id" element={<TaskDetailPage />} />
      </Routes>
    </Layout>
  )
}

export default App
