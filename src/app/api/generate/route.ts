import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { action, employee, notes, lastDay, reason } = await req.json()

  let prompt = ''

  if (action === 'onboarding') {
    prompt = `Write a warm, practical welcome message for a new small business employee named ${employee.name} starting as a ${employee.role}. Keep it friendly and human — this is a small local business, not a corporation. Include: a genuine welcome, what their first day will look like (arrive, meet the team, get shown the ropes), and one encouraging note. Then list 5 simple day-1 tasks. Keep the whole thing under 200 words. No formal HR jargon.`
  } else if (action === 'checkin') {
    prompt = `Write a short, honest performance check-in note for a small business owner's records about their employee ${employee.name} (${employee.role}). Based on these notes from the owner: "${notes || 'Generally doing well, no major issues'}". Write 2-3 sentences summarizing performance, note one strength and one area to improve. Keep it factual and fair. Plain language, no HR buzzwords.`
  } else if (action === 'offboarding') {
    prompt = `Create a simple offboarding checklist for a small business. Employee: ${employee.name}, Role: ${employee.role}, Last day: ${lastDay || 'their last day'}, Reason: ${reason || 'personal reasons'}. List 7-8 practical steps the owner needs to take: keys/access, final pay, any paperwork, notifying the team, a farewell message. Keep it plain and actionable — this owner is not an HR professional. End with a one-sentence note about staying on good terms.`
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || 'Error generating response.'

  return NextResponse.json({ text })
}
