import { type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CameraIcon from '~icons/fluent-emoji-flat/camera'
import ChildIcon from '~icons/fluent-emoji-flat/child'
import ParentIcon from '~icons/fluent-emoji-flat/person'
import TrashIcon from '~icons/fluent-emoji-flat/wastebasket'
import CheckIcon from '~icons/lucide/check'

import {
  MEMBER_ROLES,
  type Member,
  type MemberData,
  type MemberRole,
  createMember,
  deleteMember,
  removeAvatar,
  updateMember,
  uploadAvatar,
  useMembersMutation,
} from '../../api/members'
import { ApiError } from '../../api/client'
import { Avatar } from '../../components/Avatar'
import { AvatarCropper } from '../../components/AvatarCropper'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../errors'
import { COLOR_TOKENS, MEMBER_COLORS, type MemberColor } from '../../memberColors'
import { useObjectUrl } from '../../useObjectUrl'

const ROLE_ICONS: Record<MemberRole, typeof ChildIcon> = { parent: ParentIcon, child: ChildIcon }

/** Was mit dem Profilbild beim Speichern passieren soll. */
type PhotoChange = { kind: 'keep' } | { kind: 'new'; image: Blob } | { kind: 'remove' }

interface MemberEditorProps {
  /** Ohne `member` wird eine neue Person angelegt. */
  member?: Member
  members: Member[]
  onSaved: (name: string) => void
  onDeleted: (name: string) => void
  onCancel: () => void
}

export function MemberEditor({ member, members, onSaved, onDeleted, onCancel }: MemberEditorProps) {
  const { t } = useTranslation()
  const takenBy = new Map(
    members.filter((other) => other.id !== member?.id).map((other) => [other.color, other.name]),
  )
  const firstFree = MEMBER_COLORS.find((color) => !takenBy.has(color)) ?? MEMBER_COLORS[0]

  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState<MemberRole>(member?.role ?? 'child')
  const [color, setColor] = useState<MemberColor>(member?.color ?? firstFree)
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' })
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [nameMissing, setNameMissing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // Id nach dem ersten erfolgreichen Speichern: Schlägt danach nur das Foto fehl,
  // wird beim nächsten Versuch aktualisiert statt die Person doppelt anzulegen.
  const savedId = useRef(member?.id)

  const newPhotoUrl = useObjectUrl(photo.kind === 'new' ? photo.image : null)
  const photoUrl =
    photo.kind === 'new' ? newPhotoUrl : photo.kind === 'remove' ? null : member?.avatar_url

  const save = useMembersMutation(async (data: MemberData) => {
    const id = savedId.current
    const saved = id === undefined ? await createMember(data) : await updateMember(id, data)
    savedId.current = saved.id
    if (photo.kind === 'new') await uploadAvatar(saved.id, photo.image)
    else if (photo.kind === 'remove' && saved.avatar_url) await removeAvatar(saved.id)
    return saved
  })
  const remove = useMembersMutation((id: number) => deleteMember(id))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    setNameMissing(!trimmed)
    if (!trimmed) return
    save.mutate({ name: trimmed, role, color }, { onSuccess: (saved) => onSaved(saved.name) })
  }

  const nameError = nameMissing
    ? errorMessage(t, 'validation.required')
    : save.error instanceof ApiError && save.error.fields.name
      ? errorMessage(t, save.error.fields.name)
      : undefined
  const busy = save.isPending || remove.isPending

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-3xl font-extrabold text-orange-600">
        {member ? t('members.edit_title', { name: member.name }) : t('members.new_title')}
      </h1>

      <form className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm" onSubmit={submit}>
        {save.isError && !nameError && <Alert>{errorMessage(t, save.error)}</Alert>}
        {remove.isError && <Alert>{errorMessage(t, remove.error)}</Alert>}

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Avatar name={name} color={color} src={photoUrl} size="xl" />
          <div className="flex flex-col gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="photo-input"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) setCropFile(file)
              }}
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <CameraIcon className="size-8" aria-hidden="true" />
              {t(photoUrl ? 'members.change_photo' : 'members.choose_photo')}
            </Button>
            {photoUrl && (
              <Button variant="secondary" onClick={() => setPhoto({ kind: 'remove' })}>
                {t('members.remove_photo')}
              </Button>
            )}
          </div>
        </div>

        <TextField
          label={t('members.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={50}
          autoComplete="off"
          error={nameError}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-base font-bold text-slate-700">{t('members.role')}</legend>
          <div className="grid grid-cols-2 gap-3">
            {MEMBER_ROLES.map((value) => {
              const Icon = ROLE_ICONS[value]
              return (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 p-3 text-lg font-bold text-slate-700 peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-focus-visible:outline-4 peer-focus-visible:outline-orange-400">
                    <Icon className="size-10" aria-hidden="true" />
                    {t(`roles.${value}`)}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-base font-bold text-slate-700">
            {t('members.color')}
          </legend>
          <div className="flex flex-wrap gap-3">
            {MEMBER_COLORS.map((value) => {
              const owner = takenBy.get(value)
              const tokens = COLOR_TOKENS[value]
              const colorName = t(`colors.${value}`)
              return (
                <label key={value} className={owner ? 'cursor-not-allowed' : 'cursor-pointer'}>
                  <input
                    type="radio"
                    name="color"
                    value={value}
                    checked={color === value}
                    disabled={owner !== undefined}
                    onChange={() => setColor(value)}
                    aria-label={
                      owner
                        ? t('members.color_taken_by', { color: colorName, name: owner })
                        : colorName
                    }
                    className="peer sr-only"
                  />
                  <span
                    className="flex size-16 items-center justify-center rounded-full ring-offset-4 peer-checked:ring-4 peer-checked:ring-slate-800 peer-focus-visible:outline-4 peer-focus-visible:outline-offset-8 peer-focus-visible:outline-orange-400 peer-disabled:opacity-25"
                    style={{ backgroundColor: tokens.main, color: tokens.onMain }}
                    title={
                      owner
                        ? t('members.color_taken_by', { color: colorName, name: owner })
                        : colorName
                    }
                  >
                    {color === value && <CheckIcon className="size-8" aria-hidden="true" />}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {t('members.save')}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('actions.cancel')}
          </Button>
        </div>
      </form>

      {member &&
        (confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-3xl bg-red-50 p-6">
            <p className="text-lg font-semibold text-red-800">
              {t('members.delete_confirm', { name: member.name })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  remove.mutate(member.id, { onSuccess: () => onDeleted(member.name) })
                }
              >
                {t('members.delete')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('actions.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-7" aria-hidden="true" />
            {t('members.delete')}
          </Button>
        ))}

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(image) => {
            setPhoto({ kind: 'new', image })
            setCropFile(null)
          }}
        />
      )}
    </main>
  )
}
