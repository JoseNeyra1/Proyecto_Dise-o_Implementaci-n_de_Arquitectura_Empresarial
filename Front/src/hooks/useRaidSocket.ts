import { useEffect, useState, useCallback } from 'react'
import { raidSyncService } from '../services/raidSyncService'
import type { RaidState, PlayerRole, SubmitAnswerPayload } from '../types/raid.types'

export function useRaidSocket() {
  const [raidState, setRaidState] = useState<RaidState>(() => raidSyncService.getState())
  const [connectionMode, setConnectionMode] = useState<'socket' | 'local-sync'>(() =>
    raidSyncService.getConnectionMode()
  )

  useEffect(() => {
    const unsubscribe = raidSyncService.subscribe((nextState) => {
      setRaidState({ ...nextState })
      setConnectionMode(raidSyncService.getConnectionMode())
    })
    return unsubscribe
  }, [])

  const joinRaid = useCallback((studentName: string, role: PlayerRole, pin: string) => {
    return raidSyncService.emitJoinRaid(studentName, role, pin)
  }, [])

  const submitAnswer = useCallback((payload: SubmitAnswerPayload) => {
    raidSyncService.emitSubmitAnswer(payload)
  }, [])

  const useSkill = useCallback((studentName: string, role: PlayerRole) => {
    raidSyncService.emitUseSkill(studentName, role)
  }, [])

  const togglePause = useCallback(() => {
    raidSyncService.emitTeacherTogglePause()
  }, [])

  const toggleWeakenBoss = useCallback(() => {
    raidSyncService.emitTeacherToggleWeaken()
  }, [])

  const sendHintToStudent = useCallback((studentId?: string, senderName?: string) => {
    raidSyncService.emitTeacherSendHint(studentId, senderName)
  }, [])

  const tickBossTimer = useCallback(() => {
    raidSyncService.tickBossTimer()
  }, [])

  const resetRaid = useCallback(() => {
    raidSyncService.resetRaidSession()
  }, [])

  return {
    raidState,
    connectionMode,
    joinRaid,
    submitAnswer,
    useSkill,
    togglePause,
    toggleWeakenBoss,
    sendHintToStudent,
    tickBossTimer,
    resetRaid,
  }
}
