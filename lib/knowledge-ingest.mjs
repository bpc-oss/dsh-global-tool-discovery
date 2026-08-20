/**
 * knowledge-ingest — M1 最小闭环实现。
 *
 * 把研究发现沉淀为 Skill（SKILL.md）。
 */

export const name = 'knowledge-ingest'
export const inject = ['tools']

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (meta.description) prop.description = meta.description
    if (meta.items) prop.items = meta.items
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

function isValidSkillName(name) {
  return /^[a-z0-9][a-z0-9-]*$/.test(name)
}

export function apply(ctx) {
  ctx.effect(() => {
    const dispose = ctx.tools.register({
      name: 'knowledge_ingest',
      description: 'Turn research findings into a reusable DSH skill (SKILL.md). Writes to ~/.dsh/skills/<name>/SKILL.md.',
      parameters: toJsonSchema({
        name: { type: 'string', required: true, description: 'kebab-case skill name' },
        description: { type: 'string', required: true, description: 'short description' },
        whenToUse: { type: 'string', required: false, description: 'optional when-to-use guidance' },
        content: { type: 'string', required: true, description: 'skill instructions / method' },
        sources: { type: 'array', required: false, items: { type: 'string' }, description: 'source URLs' },
      }),
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
        render: (_a, v) => [{ type: 'text', text: v.text }],
      },
      async execute(args, exec) {
        const name = typeof args.name === 'string' ? args.name.trim() : ''
        const description = typeof args.description === 'string' ? args.description.trim() : ''
        const whenToUse = typeof args.whenToUse === 'string' ? args.whenToUse.trim() : ''
        const content = typeof args.content === 'string' ? args.content : ''
        const sources = Array.isArray(args.sources) ? args.sources.filter(s => typeof s === 'string') : []

        if (!isValidSkillName(name)) return { text: `Invalid skill name "${name}". Use kebab-case.` }
        if (!description || !content) return { text: 'description and content are required.' }

        const root = join(homedir(), '.dsh', 'skills')
        const skillDir = join(root, name)
        const skillFile = join(skillDir, 'SKILL.md')

        try {
          mkdirSync(skillDir, { recursive: true })
          const frontmatter = [
            '---',
            `name: ${name}`,
            `description: ${description}`,
          ]
          if (whenToUse) frontmatter.push(`whenToUse: ${whenToUse}`)
          frontmatter.push('---')

          const body = [content]
          if (sources.length > 0) {
            body.push('\n## Sources')
            for (const src of sources) body.push(`- ${src}`)
          }

          writeFileSync(skillFile, `${frontmatter.join('\n')}\n\n${body.join('\n')}\n`, 'utf8')
          return { text: `Skill created: ${skillFile}\nVerify with skill_search("${name}") and skill_load("${name}").` }
        } catch (error) {
          return { text: `knowledge_ingest failed: ${String((error && error.message) || error)}` }
        }
      },
    })
    return dispose
  })
}
