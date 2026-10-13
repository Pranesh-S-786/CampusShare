import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import {
  X,
  Package,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Star,
  MapPin,
  Building,
  DollarSign,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import {
  type College,
  type MarketplaceCategory,
  type MarketplaceListing,
  createMarketplaceListing,
  updateMarketplaceListing,
  uploadListingPhoto,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface PostItemModalProps {
  isOpen: boolean
  onClose: () => void
  categories: MarketplaceCategory[]
  colleges: College[]
  initialListing?: MarketplaceListing | null
  onListingSaved?: (listing: MarketplaceListing) => void
}

export function PostItemModal({
  isOpen,
  onClose,
  categories,
  colleges,
  initialListing,
  onListingSaved,
}: PostItemModalProps) {
  const { user, openAuthModal } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditMode = Boolean(initialListing)

  // Form Fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1)
  const [subcategory, setSubcategory] = useState('')
  const [listingType, setListingType] = useState<'lend' | 'rent' | 'sell'>('rent')
  const [condition, setCondition] = useState<'brand_new' | 'like_new' | 'good' | 'fair'>('good')
  const [price, setPrice] = useState('50')
  const [pricingUnit, setPricingUnit] = useState<'day' | 'week' | 'month' | 'semester' | 'item'>('day')
  const [depositAmount, setDepositAmount] = useState('0')
  const [pickupLocation, setPickupLocation] = useState('')
  const [collegeId, setCollegeId] = useState<number | null>(null)
  const [isAvailable, setIsAvailable] = useState(true)

  // Multi-image management
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Status & error states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Reset or Populate form on open
  useEffect(() => {
    if (!isOpen) return

    if (initialListing) {
      setTitle(initialListing.title || '')
      setDescription(initialListing.description || '')
      setCategoryId(initialListing.category?.id || categories[0]?.id || 1)
      setSubcategory(initialListing.subcategory || '')
      setListingType(initialListing.listing_type || 'rent')
      setCondition(initialListing.condition || 'good')
      setPrice(String(initialListing.price || '0'))
      setPricingUnit(initialListing.pricing_unit || 'day')
      setDepositAmount(String(initialListing.deposit_amount || '0'))
      setPickupLocation(initialListing.pickup_location || '')
      setCollegeId(initialListing.college?.id || user?.college?.id || null)
      setIsAvailable(initialListing.is_available)

      // Photos
      if (initialListing.images && initialListing.images.length > 0) {
        setImageUrls(initialListing.images.map((img) => img.image_url))
      } else if (initialListing.image_url) {
        setImageUrls([initialListing.image_url])
      } else {
        setImageUrls([])
      }
    } else {
      // Create mode
      setTitle('')
      setDescription('')
      setCategoryId(categories[0]?.id || 1)
      setSubcategory('')
      setListingType('rent')
      setCondition('good')
      setPrice('50')
      setPricingUnit('day')
      setDepositAmount('200')
      setPickupLocation('')
      setCollegeId(user?.college?.id || (colleges[0]?.id ?? null))
      setIsAvailable(true)
      setImageUrls([])
    }

    setErrorMsg(null)
    setSuccessMsg(null)
    setUploadError(null)
  }, [isOpen, initialListing, categories, colleges, user])

  if (!isOpen) return null

  // Photo upload handler
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploadingPhoto(true)
    setUploadError(null)

    const newlyUploaded: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Client validation: Max 5MB
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 5MB size limit.`)
        continue
      }

      // Client validation: MIME type
      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(file.type)) {
        setUploadError(`"${file.name}" has an unsupported format. Please upload JPEG, PNG, or WebP images.`)
        continue
      }

      try {
        const res = await uploadListingPhoto(file)
        if (res.image_url) {
          newlyUploaded.push(res.image_url)
        }
      } catch (err: any) {
        setUploadError(err.message || `Failed to upload "${file.name}".`)
      }
    }

    if (newlyUploaded.length > 0) {
      setImageUrls((prev) => [...prev, ...newlyUploaded])
    }

    setIsUploadingPhoto(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = (index: number) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSetPrimaryPhoto = (index: number) => {
    if (index === 0) return
    setImageUrls((prev) => {
      const selected = prev[index]
      const remaining = prev.filter((_, idx) => idx !== index)
      return [selected, ...remaining]
    })
  }

  // Form submission handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!user) {
      openAuthModal('login')
      return
    }

    if (!user.is_email_verified) {
      setErrorMsg('You must verify your college email address before posting listings on campus.')
      return
    }

    if (!title.trim()) {
      setErrorMsg('Please enter an item title.')
      return
    }

    // Listing type specific validation
    const numPrice = Number(price)
    const numDeposit = Number(depositAmount || 0)

    if (listingType === 'rent') {
      if (isNaN(numPrice) || numPrice <= 0) {
        setErrorMsg('Rental listings require a price per period greater than ₹0.')
        return
      }
      if (isNaN(numDeposit) || numDeposit < 0) {
        setErrorMsg('Refundable deposit cannot be negative.')
        return
      }
    } else if (listingType === 'sell') {
      if (isNaN(numPrice) || numPrice <= 0) {
        setErrorMsg('Items being sold require a positive sale price.')
        return
      }
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        subcategory: subcategory.trim(),
        listing_type: listingType,
        condition,
        price: listingType === 'lend' ? 0 : numPrice,
        deposit_amount: listingType === 'rent' ? numDeposit : 0,
        pricing_unit: listingType === 'sell' ? 'item' : pricingUnit,
        pickup_location: pickupLocation.trim(),
        college_id: collegeId,
        images: imageUrls,
        image_url: imageUrls[0] || '',
        is_available: isAvailable,
      }

      let savedListing: MarketplaceListing

      if (isEditMode && initialListing) {
        savedListing = await updateMarketplaceListing(initialListing.id, payload)
        setSuccessMsg('Your listing has been updated successfully!')
      } else {
        savedListing = await createMarketplaceListing(payload)
        setSuccessMsg('Your item has been listed on campus!')
      }

      setTimeout(() => {
        if (onListingSaved) onListingSaved(savedListing)
        onClose()
      }, 1000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save listing. Please check your inputs and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[94vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-[#FBF8F3]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shadow-xs shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                {isEditMode ? 'Edit Listing' : 'Post an Item'}
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                {isEditMode ? 'Update item details and availability' : 'Share, rent, or sell gear to your campus peers'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 safe-area-pb">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form id="post-listing-form" onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Listing Type Selector (Lend / Rent / Sell) */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5 uppercase tracking-wider font-mono">
                Listing Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'lend' as const, label: 'Lend', sub: 'Free peer sharing' },
                  { id: 'rent' as const, label: 'Rent', sub: 'Paid rental + deposit' },
                  { id: 'sell' as const, label: 'Sell', sub: 'Direct campus sale' },
                ].map((type) => {
                  const isSelected = listingType === type.id
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setListingType(type.id)
                        if (type.id === 'sell') setPricingUnit('item')
                        if (type.id === 'rent' && pricingUnit === 'item') setPricingUnit('day')
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1B3B2B] text-white border-[#1B3B2B] shadow-xs'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{type.label}</span>
                        {isSelected && <Sparkles className="w-3.5 h-3.5 text-emerald-200" />}
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>
                        {type.sub}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Item Title */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Item Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scientific Calculator (Casio FX-991EX)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:border-[#1B3B2B] focus:ring-2 focus:ring-[#1B3B2B]/10 text-xs text-stone-900 outline-none transition-all"
              />
            </div>

            {/* 3. Category & Subcategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Subcategory / Tags
                </label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="e.g. Laptops, Audio, Textbooks"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                />
              </div>
            </div>

            {/* 4. Conditional Pricing Fields Based on Listing Type */}
            {listingType === 'lend' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Free Peer Lending</span>
                </div>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  This item is offered free of charge to your fellow students on campus. No rental fees will be charged.
                </p>
              </div>
            )}

            {listingType === 'rent' && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-800">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span>Rental Pricing & Refundable Security Deposit</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Rental Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      step="any"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="50"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-900 outline-none focus:border-[#1B3B2B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Rental Period
                    </label>
                    <select
                      value={pricingUnit}
                      onChange={(e) => setPricingUnit(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                    >
                      <option value="day">per day</option>
                      <option value="week">per week</option>
                      <option value="month">per month</option>
                      <option value="semester">per semester</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Refundable Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="200"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Held securely during rental period and refunded upon safe return.
                  </p>
                </div>
              </div>
            )}

            {listingType === 'sell' && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-800">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span>Item Sale Price</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sale Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="500"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-900 outline-none focus:border-[#1B3B2B]"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Fixed one-time purchase price for selling this item directly to a campus peer.
                  </p>
                </div>
              </div>
            )}

            {/* 5. Condition Selector */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Item Condition
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'brand_new', label: 'Brand New' },
                  { id: 'like_new', label: 'Like New' },
                  { id: 'good', label: 'Good' },
                  { id: 'fair', label: 'Fair' },
                ].map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => setCondition(cond.id as any)}
                    className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      condition === cond.id
                        ? 'bg-[#1B3B2B] text-white border-[#1B3B2B] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Item Photos (Multi-photo upload to Supabase Storage) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-stone-700">
                  Item Photos ({imageUrls.length} uploaded)
                </label>
                <span className="text-[11px] text-stone-400">JPEG, PNG, WebP up to 5MB</span>
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload trigger box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer ${
                  isUploadingPhoto
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-stone-300 hover:border-emerald-700 bg-stone-50/60 hover:bg-emerald-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-1.5">
                  {isUploadingPhoto ? (
                    <>
                      <RefreshCw className="w-6 h-6 text-emerald-700 animate-spin" />
                      <p className="text-xs font-semibold text-emerald-900">
                        Uploading to Supabase Storage...
                      </p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 text-stone-400" />
                      <p className="text-xs font-semibold text-stone-700">
                        Click or drag images to upload
                      </p>
                      <p className="text-[10px] text-stone-400">
                        First image will be the primary cover photo
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Photo Previews */}
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                  {imageUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 group shadow-2xs"
                    >
                      <img
                        src={url}
                        alt={`Upload preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Primary badge */}
                      {idx === 0 ? (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#1B3B2B] text-white text-[9px] font-bold flex items-center space-x-1 shadow-xs">
                          <Star className="w-2.5 h-2.5 fill-white" />
                          <span>Cover</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryPhoto(idx)}
                          className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-stone-900/70 hover:bg-stone-900 text-white text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Set as cover photo"
                        >
                          Make Cover
                        </button>
                      )}

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 p-1 rounded-md bg-rose-600/80 hover:bg-rose-700 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 7. Campus & Pickup Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center space-x-1">
                  <Building className="w-3.5 h-3.5 text-stone-500" />
                  <span>College Campus</span>
                </label>
                <select
                  value={collegeId || ''}
                  onChange={(e) => setCollegeId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                >
                  {colleges.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.short_code ? `${col.short_code} - ${col.name}` : col.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  <span>Pickup Details</span>
                </label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. Central Library, Mech Dept Foyer"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs text-stone-900 outline-none focus:border-[#1B3B2B]"
                />
              </div>
            </div>

            {/* 8. Description */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Item Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe item condition, accessories included, or borrower requirements..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 outline-none resize-none focus:border-[#1B3B2B]"
              />
            </div>

            {/* 9. Availability Toggle (For Edit Mode or pause) */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-stone-800 block">
                  Available for Borrowing / Purchase
                </span>
                <span className="text-[11px] text-stone-500">
                  Visible in campus feeds when turned on
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAvailable(!isAvailable)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isAvailable ? 'bg-[#1B3B2B]' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isAvailable ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-100 bg-[#FBF8F3] flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="post-listing-form"
            disabled={isSubmitting || isUploadingPhoto}
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#1B3B2B] hover:bg-[#25503B] shadow-sm transition-all disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isEditMode ? 'Updating...' : 'Publishing...'}</span>
              </>
            ) : (
              <span>{isEditMode ? 'Save Changes' : 'Publish Listing'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
