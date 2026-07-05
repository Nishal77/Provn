import { db } from '@attesta/db'
import { calculateCompleteness } from './completeness.service.js'
import { didService } from './did.service.js'
import { ipfsService } from './ipfs.service.js'

export type UpdateProfileInput = {
  name?: string
  headline?: string
  bio?: string
  location?: string
  timezone?: string
  websiteUrl?: string
  githubUsername?: string
  linkedinUrl?: string
  isPublic?: boolean
  isSearchable?: boolean
}

export const profileService = {
  /**
   * Get full profile for the authenticated user.
   * Creates a profile + DID if this is the user's first access.
   */
  async getMyProfile(userId: string) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    })

    // First-time access: create profile + assign DID
    // Use did:polygon if wallet address present (Phase 3+), else did:attesta (Phase 2 temp)
    if (!user.profile) {
      const did = didService.resolveForUser(userId, (user as any).polygonAddress)
      const [profile] = await db.$transaction([
        db.profile.create({
          data: { userId, completenessScore: 0 },
        }),
        db.user.update({
          where: { id: userId },
          data: { did },
        }),
      ])
      return { user: { ...user, did, profile }, profile }
    }

    // Upgrade existing did:attesta → did:polygon if wallet was added after initial signup
    if (
      user.did?.startsWith('did:attesta:') &&
      (user as any).polygonAddress
    ) {
      const newDid = didService.generateFromWallet((user as any).polygonAddress)
      await db.user.update({ where: { id: userId }, data: { did: newDid } })
      return { user: { ...user, did: newDid }, profile: user.profile }
    }

    return { user, profile: user.profile }
  },

  /**
   * Update the authenticated user's profile.
   * Recalculates completeness score and re-pins to IPFS.
   */
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailVerified: true, name: true, kycTier: true, did: true },
    })

    // Update name on User model if provided
    const updateUser: Record<string, unknown> = {}
    if (input.name !== undefined) updateUser.name = input.name

    // Build profile update
    const profileUpdate: Record<string, unknown> = {}
    if (input.headline !== undefined) profileUpdate.headline = input.headline
    if (input.bio !== undefined) profileUpdate.bio = input.bio
    if (input.location !== undefined) profileUpdate.location = input.location
    if (input.timezone !== undefined) profileUpdate.timezone = input.timezone
    if (input.websiteUrl !== undefined) profileUpdate.websiteUrl = input.websiteUrl
    if (input.githubUsername !== undefined) profileUpdate.githubUsername = input.githubUsername
    if (input.linkedinUrl !== undefined) profileUpdate.linkedinUrl = input.linkedinUrl
    if (input.isPublic !== undefined) profileUpdate.isPublic = input.isPublic
    if (input.isSearchable !== undefined) profileUpdate.isSearchable = input.isSearchable

    // Calculate new completeness score with merged data
    const mergedUser = { ...user, name: input.name ?? user.name }
    const currentProfile = await db.profile.findUnique({ where: { userId } })
    const mergedProfile = { ...currentProfile, ...profileUpdate }

    const { score } = calculateCompleteness({
      user: {
        emailVerified: mergedUser.emailVerified,
        name: mergedUser.name ?? null,
        kycTier: mergedUser.kycTier,
      },
      profile: {
        headline: (mergedProfile.headline as string | null) ?? null,
        bio: (mergedProfile.bio as string | null) ?? null,
        location: (mergedProfile.location as string | null) ?? null,
        githubUsername: (mergedProfile.githubUsername as string | null) ?? null,
        linkedinUrl: (mergedProfile.linkedinUrl as string | null) ?? null,
        websiteUrl: (mergedProfile.websiteUrl as string | null) ?? null,
      },
    })

    profileUpdate.completenessScore = score

    const [updatedProfile] = await db.$transaction([
      db.profile.update({ where: { userId }, data: profileUpdate }),
      ...(Object.keys(updateUser).length > 0
        ? [db.user.update({ where: { id: userId }, data: updateUser })]
        : []),
    ])

    // Pin updated snapshot to IPFS (best-effort, non-blocking)
    if (user.did) {
      const updatedUser = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, kycTier: true },
      })

      setImmediate(async () => {
        try {
          // Unpin old CID if exists
          if (currentProfile?.ipfsCid) {
            await ipfsService.unpin(currentProfile.ipfsCid)
          }

          const cid = await ipfsService.pinProfile({
            did: user.did!,
            name: updatedUser.name,
            headline: (mergedProfile.headline as string | null) ?? null,
            bio: (mergedProfile.bio as string | null) ?? null,
            location: (mergedProfile.location as string | null) ?? null,
            githubUsername: (mergedProfile.githubUsername as string | null) ?? null,
            trustScore: Number(updatedProfile.overallTrustScore),
            kycTier: updatedUser.kycTier,
            createdAt: updatedProfile.createdAt.toISOString(),
          })

          if (cid) {
            await db.profile.update({
              where: { userId },
              data: { ipfsCid: cid, ipfsUpdatedAt: new Date() },
            })
          }
        } catch {
          // IPFS errors are non-fatal — profile update succeeded
        }
      })
    }

    return updatedProfile
  },

  /**
   * Get a public profile by DID.
   * Returns null if the profile doesn't exist or is set to private.
   */
  async getPublicProfile(did: string) {
    const user = await db.user.findUnique({
      where: { did },
      select: {
        id: true,
        did: true,
        name: true,
        imageUrl: true,
        kycTier: true,
        createdAt: true,
        profile: {
          select: {
            headline: true,
            bio: true,
            location: true,
            websiteUrl: true,
            githubUsername: true,
            linkedinUrl: true,
            completenessScore: true,
            overallTrustScore: true,
            isPublic: true,
            ipfsCid: true,
          },
        },
      },
    })

    if (!user?.profile?.isPublic) return null

    return {
      did: user.did,
      name: user.name,
      imageUrl: user.imageUrl,
      kycTier: user.kycTier,
      memberSince: user.createdAt,
      profile: user.profile,
      ipfsUrl: user.profile.ipfsCid
        ? ipfsService.gatewayUrl(user.profile.ipfsCid)
        : null,
    }
  },

  /**
   * Get the completeness breakdown for the authenticated user.
   */
  async getCompleteness(userId: string) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user.profile) {
      return { score: 0, items: [] }
    }

    return calculateCompleteness({
      user: {
        emailVerified: user.emailVerified,
        name: user.name,
        kycTier: user.kycTier,
      },
      profile: user.profile,
    })
  },
}
