"use server"

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

export async function submitReport(formData: FormData) {
  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const status = formData.get('status') as string
  const message = formData.get('message') as string | null
  const isPrivate = formData.get('isPrivate') === 'on'
  
  const priority = (formData.get('priority') as string) || 'MODERATE'
  const latStr = formData.get('latitude') as string | null
  const lonStr = formData.get('longitude') as string | null
  const userId = formData.get('userId') as string | null
  let category = formData.get('category') as string | null

  if (!name || !location || !status) {
    throw new Error('Missing required fields')
  }

  // Auto-tagging based on message if not explicitly set
  if (message && !category) {
    const lowerMsg = message.toLowerCase()
    if (lowerMsg.includes('water') || lowerMsg.includes('flood') || lowerMsg.includes('river')) {
      category = 'FLOOD'
    } else if (lowerMsg.includes('fire') || lowerMsg.includes('smoke')) {
      category = 'FIRE'
    } else if (lowerMsg.includes('bleed') || lowerMsg.includes('medical') || lowerMsg.includes('hurt') || lowerMsg === 'medical') {
      category = 'MEDICAL'
    } else if (lowerMsg === 'trapped') {
      category = 'TRAPPED'
    } else if (lowerMsg === 'food_water') {
      category = 'RESOURCES'
    } else if (lowerMsg.includes('violence')) {
      category = 'SECURITY'
    } else if (lowerMsg.includes('road') || lowerMsg.includes('block') || lowerMsg.includes('tree')) {
      category = 'INFRA_ROAD'
    } else if (lowerMsg.includes('bridge') || lowerMsg.includes('collapse') || lowerMsg.includes('rubble')) {
      category = 'INFRA_BRIDGE'
    } else if (lowerMsg.includes('power') || lowerMsg.includes('electricity') || lowerMsg.includes('signal') || lowerMsg.includes('network')) {
      category = 'INFRA_POWER'
    }
  }

  const finalLocation = isPrivate ? `[HIDDEN]${location}` : location

  const { error } = await supabase
    .from('reports')
    .insert({
      name,
      location: finalLocation,
      status,
      priority,
      message: message || null,
      category,
      latitude: latStr ? parseFloat(latStr) : null,
      longitude: lonStr ? parseFloat(lonStr) : null,
      user_id: userId,
    })

  if (error) {
    throw new Error(`Failed to create report: ${error.message}`)
  }

  revalidatePath('/')
}

export async function resolveReport(id: number) {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to resolve report: ${error.message}`)
  }

  revalidatePath('/')
}
