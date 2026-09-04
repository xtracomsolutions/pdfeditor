import type { ComponentType, SVGProps } from 'react'
import { useApp } from '../state/store'
import type { ToolId } from '../state/types'
import {
  IconArrow,
  IconCircle,
  IconCursor,
  IconForm,
  IconHand,
  IconHighlight,
  IconImage,
  IconLine,
  IconNote,
  IconPen,
  IconRedact,
  IconReplace,
  IconSignature,
  IconSquare,
  IconStamp,
  IconStrike,
  IconText,
  IconUnderline,
} from './icons'

type Ico = ComponentType<SVGProps<SVGSVGElement>>
interface Item {
  id: ToolId
  label: string
  Icon: Ico
}

const GROUPS: Item[][] = [
  [
    { id: 'select', label: 'Select', Icon: IconCursor },
    { id: 'hand', label: 'Pan', Icon: IconHand },
  ],
  [
    { id: 'highlight', label: 'Highlight', Icon: IconHighlight },
    { id: 'underline', label: 'Underline', Icon: IconUnderline },
    { id: 'strikeout', label: 'Strikeout', Icon: IconStrike },
  ],
  [
    { id: 'ink', label: 'Draw', Icon: IconPen },
    { id: 'rectangle', label: 'Rectangle', Icon: IconSquare },
    { id: 'ellipse', label: 'Ellipse', Icon: IconCircle },
    { id: 'line', label: 'Line', Icon: IconLine },
    { id: 'arrow', label: 'Arrow', Icon: IconArrow },
  ],
  [
    { id: 'textbox', label: 'Text box', Icon: IconText },
    { id: 'replace-text', label: 'Replace text (white-out + retype)', Icon: IconReplace },
    { id: 'note', label: 'Sticky note', Icon: IconNote },
    { id: 'stamp', label: 'Stamp', Icon: IconStamp },
    { id: 'image', label: 'Image', Icon: IconImage },
  ],
  [
    { id: 'form-fill', label: 'Fill form', Icon: IconForm },
    { id: 'signature', label: 'Sign', Icon: IconSignature },
  ],
  [{ id: 'redact', label: 'Redact', Icon: IconRedact }],
]

export function Toolbar() {
  const activeTool = useApp((s) => s.ui.activeTool)
  const setTool = useApp((s) => s.setTool)

  return (
    <div className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-chrome-line bg-ink py-3">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col items-center gap-1">
          {gi > 0 && <div className="my-1 h-px w-6 bg-chrome-line" />}
          {group.map(({ id, label, Icon }) => {
            const on = activeTool === id
            return (
              <button
                key={id}
                onClick={() => setTool(id)}
                title={label}
                aria-pressed={on}
                className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                  on
                    ? 'bg-accent text-white shadow-[0_0_0_1px_var(--color-accent-dark),0_4px_12px_rgba(75,175,214,0.35)]'
                    : 'text-chrome-muted hover:bg-white/8 hover:text-chrome-text'
                }`}
              >
                <Icon width={18} height={18} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
