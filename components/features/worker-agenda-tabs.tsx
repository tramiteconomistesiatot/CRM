'use client'

import { useState } from 'react'
import { Calendar, ClipboardList } from 'lucide-react'
import { AgendaClient } from './agenda-client'
import { CitesWorkerClient } from './cites-worker-client'

interface WorkerAgendaTabsProps {
  absences: any[]
  profiles: any[]
  holidays: any[]
  closures: any[]
  currentUserId: string
  fiscalDeadlines: any[]
  appointments: any[]
}

export function WorkerAgendaTabs({
  absences,
  profiles,
  holidays,
  closures,
  currentUserId,
  fiscalDeadlines,
  appointments,
}: WorkerAgendaTabsProps) {
  const [activeTab, setActiveTab] = useState<'calendari' | 'cites'>('calendari')

  return (
    <div className="space-y-4">
      {/* Selector de pestañas */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('calendari')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'calendari'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Calendari de l&apos;equip
        </button>
        <button
          onClick={() => setActiveTab('cites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'cites'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Les meves cites
        </button>
      </div>

      {activeTab === 'calendari' ? (
        <AgendaClient
          absences={absences}
          profiles={profiles}
          holidays={holidays}
          closures={closures}
          currentUserId={currentUserId}
          currentUserRole="worker"
          fiscalDeadlines={fiscalDeadlines}
          appointments={appointments}
        />
      ) : (
        <CitesWorkerClient
          appointments={appointments.filter(appt => {
            const isMain = appt.main_attendee_id === currentUserId
            const isAttendee = appt.appointment_attendees?.some((aa: any) => aa.user_id === currentUserId)
            const isCancelledOrCompleted = appt.status === 'cancelled' || appt.status === 'completed'
            return (isMain || isAttendee) && !isCancelledOrCompleted
          })}
          currentUserId={currentUserId}
          currentUserRole="worker"
        />
      )}
    </div>
  )
}
