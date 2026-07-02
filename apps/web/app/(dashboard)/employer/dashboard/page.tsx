import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import EmployerDashboardClient from './EmployerDashboardClient'

export default async function EmployerDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <EmployerDashboardClient />
}
