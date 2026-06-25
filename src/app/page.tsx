'use client'

import { useState } from 'react'
import Dashboard from './components/Dashboard'
import ActionScreen from './components/ActionScreen'

export type Employee = {
  id: number
  name: string
  role: string
  start: string
  type: string
}

export type ActionType = 'onboarding' | 'checkin' | 'offboarding' | null

const defaultEmployees: Employee[] = [
  { id: 1, name: 'Maria Garcia', role: 'Store Manager', start: '2022-03-15', type: 'Full-time' },
  { id: 2, name: 'Tom Bradley', role: 'Cashier', start: '2024-01-08', type: 'Part-time' },
  { id: 3, name: 'Lisa Park', role: 'Inventory Lead', start: '2023-06-20', type: 'Full-time' },
  { id: 4, name: 'Derek James', role: 'Delivery Driver', start: '2024-09-01', type: 'Full-time' },
]

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>(defaultEmployees)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [action, setAction] = useState<ActionType>(null)
  const [docsGenerated, setDocsGenerated] = useState(7)

  function addEmployee(emp: Omit<Employee, 'id'>) {
    setEmployees(prev => [...prev, { ...emp, id: Date.now() }])
  }

  function startAction(type: ActionType) {
    if (!selectedEmp) return
    setAction(type)
  }

  function goHome() {
    setAction(null)
  }

  function onDocDone() {
    setDocsGenerated(n => n + 1)
  }

  if (action && selectedEmp) {
    return (
      <ActionScreen
        employee={selectedEmp}
        action={action}
        onBack={goHome}
        onDocDone={onDocDone}
      />
    )
  }

  return (
    <Dashboard
      employees={employees}
      selectedEmp={selectedEmp}
      docsGenerated={docsGenerated}
      onSelectEmp={setSelectedEmp}
      onAddEmployee={addEmployee}
      onStartAction={startAction}
    />
  )
}
