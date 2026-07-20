import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2, ImageIcon, Download, Upload, Trash2, Camera, Users, StickyNote } from 'lucide-react';
import api from '../services/api';
import { familyService } from '../services/family.service';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';

interface GeneratedPortrait {
  url: string;
  prompt: string;
  model: string;
  costUsd: number;
  latencyMs: number;
}

interface TaggedMember {
  id: string;
  name: string;
}

interface FamilyPhoto {
  id: string;
  url: string; // relative /uploads/<filename> path
  caption: string | null;
  note: string | null;
  taggedMembers: TaggedMember[];
  uploadedBy: string;
  createdAt?: string;
}

// Origin of the backend (e.g. http://localhost:6100) for displaying uploaded files
const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');

/** Full URL for <img> display; API calls keep the relative /uploads path. */
const displayUrl = (url: string) => (url.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url);

const TEMPLATES = [
  'A warm watercolor portrait of a multi-generation family at dinner',
  'Grandfather and grandchildren flying bamboo kites on a beach at sunset',
  'A cozy Lunar New Year kitchen scene, grandmother cooking pho, soft light',
  'Vintage-style family photo in front of an old house in Hoi An',
];

export default function Portraits() {
  const user = useAuthStore((s) => s.user);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [gallery, setGallery] = useState<GeneratedPortrait[]>([]);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Photo Room state
  const [photos, setPhotos] = useState<FamilyPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload dialog state (tag people + note before saving)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState('');
  const [taggedIds, setTaggedIds] = useState<string[]>([]);

  const { data: membersData } = useQuery({
    queryKey: ['members'],
    queryFn: familyService.getMembers,
    enabled: !!user?.familyId,
  });
  const members = membersData?.members ?? [];

  useEffect(() => {
    api
      .get('/photos')
      .then((res) => setPhotos(res.data.photos || []))
      .catch(() => setPhotoError('Could not load family photos.'));
  }, []);

  const openUploadDialog = (file: File) => {
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setCaption('');
    setNote('');
    setTaggedIds([]);
    setPhotoError('');
  };

  const closeUploadDialog = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview('');
  };

  const toggleTag = (id: string) => {
    setTaggedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const savePhoto = async () => {
    if (!pendingFile) return;
    setPhotoError('');
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', pendingFile);
      if (caption.trim()) formData.append('caption', caption.trim());
      if (note.trim()) formData.append('note', note.trim());
      if (taggedIds.length > 0) formData.append('taggedMembers', JSON.stringify(taggedIds));
      const res = await api.post('/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotos((prev) => [res.data.photo, ...prev]);
      closeUploadDialog();
    } catch (err: any) {
      setPhotoError(err.response?.data?.error?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePhoto = async (id: string) => {
    setPhotoError('');
    try {
      await api.delete(`/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setPhotoError(err.response?.data?.error?.message || 'Could not delete photo.');
    }
  };

  const generate = async () => {
    const p = prompt.trim();
    if (p.length < 10 || isGenerating) return;
    setError('');
    setIsGenerating(true);
    try {
      // With a source photo selected, transform it; otherwise create from text
      const res = sourceImage
        ? await api.post('/images/edit', { prompt: p, imageUrl: sourceImage, n: 1 })
        : await api.post('/images/generate', { prompt: p, n: 1, size: '1024x1024' });
      const data = res.data.data;
      const url = data.images?.[0]?.url;
      if (!url) throw new Error('No image returned');
      setGallery((g) => [
        { url, prompt: p, model: data.model, costUsd: data.cost?.totalCost ?? 0, latencyMs: data.latencyMs ?? 0 },
        ...g,
      ]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Image generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Family Portraits</h1>
        <p className="text-gray-600">
          Generate artwork of your family moments with Qwen image models
        </p>
      </div>

      <div className="card p-6 space-y-4">
        {sourceImage && (
          <div className="flex items-center gap-3 p-2 bg-primary-50 border border-primary-200 rounded-lg">
            <img src={displayUrl(sourceImage)} alt="source" className="w-14 h-14 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-700">Transforming this photo</p>
              <p className="text-xs text-gray-500">Describe the change below (e.g. "make it a watercolor painting")</p>
            </div>
            <button
              onClick={() => setSourceImage(null)}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              ✕ Clear
            </button>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the family moment to illustrate... (e.g., 'Grandpa teaching the kids to fish at dawn, watercolor style')"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t}
              onClick={() => setPrompt(t)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200 transition-colors"
            >
              {t.slice(0, 48)}…
            </button>
          ))}
        </div>
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        <button
          onClick={generate}
          disabled={prompt.trim().length < 10 || isGenerating}
          className="btn-primary"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Painting… (~10s)
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {sourceImage ? 'Transform Photo' : 'Generate Portrait'}
            </>
          )}
        </button>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="…or paste a public image URL to use as the source photo"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={() => {
              if (urlInput.trim().startsWith('http')) {
                setSourceImage(urlInput.trim());
                setUrlInput('');
              }
            }}
            disabled={!urlInput.trim().startsWith('http')}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Use photo
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary-600" />
              Family Gallery
            </h2>
            <p className="text-sm text-gray-600">
              Upload real family photos, tag who's in them, and save the memory
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) openUploadDialog(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-primary"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </>
            )}
          </button>
        </div>
        {photoError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{photoError}</div>
        )}
        {photos.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No photos yet — upload a family photo (JPEG, PNG or WebP, up to 5MB) to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-warm-200 bg-warm-50 flex flex-col">
                <img
                  src={displayUrl(photo.url)}
                  alt={photo.caption || 'Family photo'}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2.5 space-y-2 flex-1 flex flex-col">
                  {photo.caption && (
                    <p className="text-sm font-medium text-gray-900 truncate" title={photo.caption}>
                      {photo.caption}
                    </p>
                  )}
                  {photo.note && (
                    <p className="text-xs text-gray-600 line-clamp-3" title={photo.note}>
                      {photo.note}
                    </p>
                  )}
                  {photo.taggedMembers?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {photo.taggedMembers.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[11px] rounded-full"
                        >
                          <Users className="w-2.5 h-2.5" />
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 mt-auto border-t border-warm-200">
                    <button
                      onClick={() => {
                        setSourceImage(photo.url);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      Use as source
                    </button>
                    {photo.uploadedBy === user?.id && (
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload dialog — tag people + add a note before saving */}
      <Modal isOpen={!!pendingFile} onClose={closeUploadDialog} title="Add to Family Gallery" size="md">
        <div className="space-y-4">
          {pendingPreview && (
            <img
              src={pendingPreview}
              alt="Preview"
              className="w-full max-h-56 object-contain rounded-lg bg-warm-50"
            />
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Beach day 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary-600" />
              Who's in this photo?
            </label>
            {members.length === 0 ? (
              <p className="text-xs text-gray-400">No family members to tag yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const active = taggedIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleTag(m.id)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        active
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-primary-600" />
              Memory note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What's the story behind this photo?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          {photoError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{photoError}</div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button onClick={closeUploadDialog} className="btn-secondary" disabled={isUploading}>
              Cancel
            </button>
            <button onClick={savePhoto} className="btn-primary" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save to Gallery'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {gallery.length === 0 ? (
        <div className="card p-12 text-center">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No portraits yet</h2>
          <p className="text-gray-600">
            Describe a family moment above and let Qwen paint it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gallery.map((img, i) => (
            <div key={i} className="card overflow-hidden">
              <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />
              <div className="p-3">
                <p className="text-sm text-gray-700 line-clamp-2">{img.prompt}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>
                    {img.model} · ${img.costUsd.toFixed(3)} · {(img.latencyMs / 1000).toFixed(1)}s
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSourceImage(img.url);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      Remix
                    </button>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      Open
                    </a>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
