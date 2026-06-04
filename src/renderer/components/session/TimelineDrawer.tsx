import { ActionIcon, Badge, Box, Divider, Flex, ScrollArea, Text, Tooltip } from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import type { Message, Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { IconGitBranch, IconMessageCircle, IconX } from '@tabler/icons-react'
import { useAtom } from 'jotai'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/stores/settingsStore'
import { showTimelineDrawerAtom } from '@/stores/atoms'
import { scrollToMessage } from '@/stores/scrollActions'
import { switchForkToList } from '@/stores/sessionActions'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import { ScalableIcon } from '../common/ScalableIcon'

type TimelinePathStep = {
  forkMessageId: string
  listId: string
}

type TimelineMessageNode = {
  id: string
  message: Message
  depth: number
  path: TimelinePathStep[]
  branches: TimelineBranch[]
}

type TimelineBranch = {
  id: string
  forkMessageId: string
  listId: string
  index: number
  isCurrent: boolean
  depth: number
  path: TimelinePathStep[]
  nodes: TimelineMessageNode[]
  messageCount: number
  lastAt: number
}

export default function TimelineDrawer({ session }: { session: Session }) {
  const { t } = useTranslation()
  const language = useLanguage()
  const [showDrawer, setShowDrawer] = useAtom(showTimelineDrawerAtom)

  const timeline = useMemo(() => buildTimeline(session), [session])
  const hasForks = !!session.messageForksHash && Object.keys(session.messageForksHash).length > 0

  const activatePath = useCallback(
    async (path: TimelinePathStep[], messageId: string) => {
      for (const step of path) {
        await switchForkToList(session.id, step.forkMessageId, step.listId)
      }
      setShowDrawer(false)
      window.setTimeout(() => {
        void scrollToMessage(session.id, messageId, 'center', 'smooth')
      }, 120)
    },
    [session.id, setShowDrawer]
  )

  const activateNode = useCallback(
    (node: TimelineMessageNode) => {
      const latestBranch = pickLatestBranch(node.branches)
      const path = latestBranch?.path ?? node.path
      void activatePath(path, node.id)
    },
    [activatePath]
  )

  const activateBranch = useCallback(
    (branch: TimelineBranch) => {
      const targetMessageId = branch.nodes[0]?.id ?? branch.forkMessageId
      void activatePath(branch.path, targetMessageId)
    },
    [activatePath]
  )

  return (
    <SwipeableDrawer
      anchor={language === 'ar' ? 'left' : 'right'}
      variant="temporary"
      open={showDrawer}
      onClose={() => setShowDrawer(false)}
      onOpen={() => setShowDrawer(true)}
      title={t('Timeline') || ''}
      ModalProps={{
        keepMounted: true,
      }}
      classes={{
        paper:
          'bg-none box-border w-[420px] max-w-[92vw] flex flex-col gap-0 pt-[var(--mobile-safe-area-inset-top)] pb-[var(--mobile-safe-area-inset-bottom)]',
      }}
      SlideProps={language === 'ar' ? { direction: 'right' } : undefined}
      PaperProps={
        language === 'ar' ? { sx: { direction: 'rtl', overflowY: 'initial' } } : { sx: { overflowY: 'initial' } }
      }
      disableSwipeToOpen={CHATBOX_BUILD_PLATFORM !== 'ios'}
      disableEnforceFocus={true}
    >
      <Flex align="center" justify="space-between" className="px-sm py-xs">
        <Flex align="center" gap="xs">
          <ScalableIcon icon={IconGitBranch} size={20} />
          <Text size="md" fw={600}>
            {t('Timeline')}
          </Text>
        </Flex>
        <ActionIcon variant="transparent" color="chatbox-primary" onClick={() => setShowDrawer(false)}>
          <ScalableIcon icon={IconX} size={20} />
        </ActionIcon>
      </Flex>
      <Divider />
      <ScrollArea className="flex-1">
        {!hasForks ? (
          <Flex direction="column" gap="xs" className="px-md py-lg">
            <Text size="sm" c="chatbox-secondary">
              {t('No timeline branches yet')}
            </Text>
            <Text size="xs" c="chatbox-tertiary">
              {t('Use Reply Again to create alternate branches.')}
            </Text>
          </Flex>
        ) : (
          <Box className="py-xs">
            {timeline.map((node) => (
              <TimelineNodeItem key={node.id} node={node} onActivateNode={activateNode} onActivateBranch={activateBranch} />
            ))}
          </Box>
        )}
      </ScrollArea>
    </SwipeableDrawer>
  )
}

function TimelineNodeItem({
  node,
  onActivateNode,
  onActivateBranch,
}: {
  node: TimelineMessageNode
  onActivateNode(node: TimelineMessageNode): void
  onActivateBranch(branch: TimelineBranch): void
}) {
  const { t } = useTranslation()
  const text = getNodePreview(node.message)
  const createdAt = formatTime(node.message.timestamp)
  const hasBranches = node.branches.length > 0

  const meta = [
    createdAt,
    node.message.model,
    node.message.wordCount !== undefined ? `${node.message.wordCount} words` : undefined,
    node.message.usage?.totalTokens ? `${node.message.usage.totalTokens} tokens` : undefined,
  ].filter(Boolean)

  return (
    <>
      <Tooltip
        withArrow
        multiline
        maw={360}
        label={
          <Box>
            <Text size="xs" fw={600}>
              {roleLabel(node.message.role)}
            </Text>
            <Text size="xs" className="whitespace-pre-wrap">
              {text || t('Empty message')}
            </Text>
            {meta.length > 0 && (
              <Text size="11px" mt={4}>
                {meta.join(' · ')}
              </Text>
            )}
          </Box>
        }
      >
        <Flex
          align="flex-start"
          gap="xs"
          className="px-xs py-xxs cursor-pointer hover:bg-chatbox-background-gray-secondary"
          style={{ paddingInlineStart: `${8 + node.depth * 20}px` }}
          onDoubleClick={() => onActivateNode(node)}
        >
          <Box className="relative mt-[3px] w-[16px] h-[16px] shrink-0">
            {node.depth > 0 && <Box className="absolute left-[7px] top-[-12px] h-[20px] border-l border-chatbox-border-primary" />}
            <ScalableIcon icon={hasBranches ? IconGitBranch : IconMessageCircle} size={16} />
          </Box>
          <Badge size="xs" color={roleColor(node.message.role)} variant="light" className="shrink-0">
            {roleLabel(node.message.role)}
          </Badge>
          <Box className="min-w-0 flex-1">
            <Text size="xs" lineClamp={2}>
              {text || t('Empty message')}
            </Text>
            {meta.length > 0 && (
              <Text size="11px" c="chatbox-tertiary" lineClamp={1}>
                {meta.join(' · ')}
              </Text>
            )}
          </Box>
        </Flex>
      </Tooltip>
      {node.branches.map((branch) => (
        <Box key={branch.id}>
          <Flex
            align="center"
            gap="xs"
            className="px-xs py-[3px] cursor-pointer hover:bg-chatbox-background-gray-secondary"
            style={{ paddingInlineStart: `${28 + branch.depth * 20}px` }}
            onDoubleClick={() => onActivateBranch(branch)}
          >
            <Box className="w-[16px] h-[14px] border-l border-b rounded-bl-sm border-chatbox-border-primary shrink-0" />
            <Text size="11px" c="chatbox-tertiary" className="shrink-0">
              {t('Branch')} {branch.index + 1}
            </Text>
            <Badge size="xs" color={branch.isCurrent ? 'blue' : 'gray'} variant="light">
              {branch.isCurrent ? t('Current') : `${branch.messageCount}`}
            </Badge>
            <Text size="11px" c="chatbox-tertiary" lineClamp={1}>
              {formatTime(branch.lastAt)}
            </Text>
          </Flex>
          {branch.nodes.map((child) => (
            <TimelineNodeItem
              key={child.id}
              node={child}
              onActivateNode={onActivateNode}
              onActivateBranch={onActivateBranch}
            />
          ))}
        </Box>
      ))}
    </>
  )
}

function buildTimeline(session: Session): TimelineMessageNode[] {
  return buildTimelineNodes(session.messages ?? [], session, [], 0, new Set())
}

function buildTimelineNodes(
  messages: Message[],
  session: Session,
  path: TimelinePathStep[],
  depth: number,
  seenForks: Set<string>
): TimelineMessageNode[] {
  const nodes: TimelineMessageNode[] = []
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    const forkEntry = session.messageForksHash?.[message.id]
    const node: TimelineMessageNode = {
      id: message.id,
      message,
      depth,
      path,
      branches: [],
    }

    if (forkEntry && forkEntry.lists.length > 1 && !seenForks.has(message.id)) {
      const nextSeenForks = new Set(seenForks)
      nextSeenForks.add(message.id)
      node.branches = forkEntry.lists.map((list, index) => {
        const branchMessages = index === forkEntry.position ? messages.slice(i + 1) : list.messages
        const branchPath = [...path, { forkMessageId: message.id, listId: list.id }]
        return {
          id: `${message.id}:${list.id}`,
          forkMessageId: message.id,
          listId: list.id,
          index,
          isCurrent: index === forkEntry.position,
          depth: depth + 1,
          path: branchPath,
          nodes: buildTimelineNodes(branchMessages, session, branchPath, depth + 1, nextSeenForks),
          messageCount: branchMessages.length,
          lastAt: getLatestMessageTime(branchMessages, forkEntry.createdAt),
        }
      })
      nodes.push(node)
      break
    }

    nodes.push(node)
  }
  return nodes
}

function pickLatestBranch(branches: TimelineBranch[]): TimelineBranch | null {
  if (branches.length === 0) {
    return null
  }
  return branches.reduce((latest, branch) => (branch.lastAt >= latest.lastAt ? branch : latest), branches[0])
}

function getLatestMessageTime(messages: Message[], fallback: number): number {
  return messages.reduce((latest, message) => Math.max(latest, message.timestamp ?? message.updatedAt ?? 0), fallback)
}

function getNodePreview(message: Message): string {
  return getMessageText(message, true, true).replace(/\s+/g, ' ').trim().slice(0, 260)
}

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return ''
  }
  return new Date(timestamp).toLocaleString()
}

function roleLabel(role: Message['role']) {
  if (role === 'assistant') {
    return 'AI'
  }
  return role
}

function roleColor(role: Message['role']) {
  if (role === 'assistant') {
    return 'blue'
  }
  if (role === 'user') {
    return 'green'
  }
  if (role === 'system') {
    return 'gray'
  }
  return 'grape'
}
