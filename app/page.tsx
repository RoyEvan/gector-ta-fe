"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { CheckCircle } from "lucide-react"
import { NavBar } from "@/components/navbar"

type GECErrorDetail = {
  error_type: string
  explanation: string
  orig_start: number
  orig_end: number
  corr_start: number
  corr_end: number
  correction: string
}

type SentenceGECResult = {
  id: string
  orig_sentence: string
  corr_sentence: string
  voice_type: "active" | "passive"
  is_saved: boolean
  voice_analysis: string
  correction_details: GECErrorDetail[]
}

type ResponseResult = {
  status: {
    code: number
    message: string
  }
  data: SentenceGECResult[]
}

const backendBaseUrl = process.env.NEXT_PUBLIC_SKRIPSI_GECTAGGING_BACKEND_URL;

export default function GrammarChecker() {
  const { data: session, status } = useSession()
  const [inputText, setInputText] = useState("")
  const [correctedText, setCorrectedText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [useFileInput, setUseFileInput] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const [fileError, setFileError] = useState<string>("")
  const [correctionId, setCorrectionId] = useState<string[]>([])
  const [saveMessage, setSaveMessage] = useState("")
  const [savedCorrections, setSavedCorrections] = useState<SentenceGECResult[]>([])
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
  const [savedStatus, setSavedStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [savedMessage, setSavedMessage] = useState("")
  const [selectedSavedIndex, setSelectedSavedIndex] = useState<number | null>(null)
  const [historyCorrections, setHistoryCorrections] = useState<SentenceGECResult[]>([])
  const [historyMessage, setHistoryMessage] = useState("")
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null)
  const [showSavedSection, setShowSavedSection] = useState(true)
  const [showHistorySection, setShowHistorySection] = useState(true)
  const [showErrorExplanation, setShowErrorExplanation] = useState(true)
  const [showVoiceAnalysis, setShowVoiceAnalysis] = useState(true)
  
  // Grouped results by sentence
  const [groupedResults, setGroupedResults] = useState<SentenceGECResult[]>([])

  const isLoggedIn = status === "authenticated"

  useEffect(() => {
    if (status === "unauthenticated") {
      clearAll()
    }
  }, [status])
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileError("")
    if (!file) {
      setFileName("")
      setInputText("")
      return
    }
    const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")
    if (!isTxt) {
      setFileError("Please upload a valid .txt file.")
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setInputText((reader.result as string) || "")
    }
    reader.onerror = () => setFileError("Failed to read the file. Please try again.")
    reader.readAsText(file)
  }

  const downloadCorrected = () => {
    if (!correctedText) return
    const blob = new Blob([correctedText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const base = fileName ? fileName.replace(/\.txt$/i, "") : "corrected"
    a.href = url
    a.download = `${base}-corrected.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function splitIntoSentences(text: string): string[] {
    const normalized = text.replace(/\s+/g, " ").trim()
    if (!normalized) return []
    const matches = normalized.match(/[^.!?]+[.!?]*/g) || []
    return matches.map((s) => s.trim()).filter(Boolean)
  }

  const handleCorrection = async () => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    setIsProcessing(true)

    await new Promise((r) => setTimeout(r, 600))

    const sentences = splitIntoSentences(trimmed)
    const rawSentences = sentences.map((s) => s.trim())
    const request = await fetch(`${backendBaseUrl}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentences: rawSentences, iteration_count: 3, user_id: session?.user?.user_id }),
    })
    const response: ResponseResult = await request.json()

    const correctionData = response.data || []
    setGroupedResults(correctionData)
    setCorrectionId(correctionData.map(({ id }) => id))
    setSaveStatus("idle")
    setSaveMessage("")
    const combined = correctionData.map((r) => r.corr_sentence).join(" ")
    setCorrectedText(combined)
    setIsProcessing(false)
  }

  const clearAll = () => {
    setInputText("")
    setCorrectedText("")
    setGroupedResults([])
    setFileError("")
    setFileName("")
    setCorrectionId([])
    setSaveStatus("idle")
    setSaveMessage("")
  }

  const handleViewSavedCorrections = async () => {
    const userId = session?.user?.user_id
    if (!userId) {
      setSavedStatus("error")
      setSavedMessage("Login required to view saved corrections.")
      return
    }

    try {
      setSavedStatus("loading")
      setSavedMessage("")
      const request = await fetch(`${backendBaseUrl}/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      const response: ResponseResult = await request.json()
      
      if (response.status.code !== 200) {
        throw new Error("Failed to fetch saved corrections.")
      }
      
      setSavedCorrections(response.data)
      setSelectedSavedIndex(null)
      setSavedStatus("success")
      if (response.data.length === 0) {
        setSavedMessage("No saved corrections found.")
      }
    } catch (error) {
      setSavedStatus("error")
      setSavedMessage("Failed to fetch saved corrections.")
    }
  }

  const handleViewHistory = async () => {
    const userId = session?.user?.user_id
    if (!userId) {
      setHistoryStatus("error")
      setHistoryMessage("Login required to view history.")
      return
    }

    try {
      setHistoryStatus("loading")
      setHistoryMessage("")
      const request = await fetch(`${backendBaseUrl}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      const response = await request.json()
      if (response.status.code !== 200) {
        throw new Error("Failed to fetch history.")
      }

      setHistoryCorrections(response.data)
      setSelectedHistoryIndex(null)
      setHistoryStatus("success")
      if (response.data.length === 0) {
        setHistoryMessage("No history found.")
      }
    } catch (error) {
      setHistoryStatus("error")
      setHistoryMessage("Failed to fetch history.")
    }
  }

  const handleSelectSavedCorrection = (index: number) => {
    setSelectedSavedIndex(index)
    setSelectedHistoryIndex(null)
    handleSelectCorrection(savedCorrections, index)
  }
  
  const handleSelectHistoryCorrection = (index: number) => {
    setSelectedHistoryIndex(index)
    setSelectedSavedIndex(null)
    handleSelectCorrection(historyCorrections, index)
  }

  const handleSelectCorrection = (corrections: SentenceGECResult[], index: number) => {
    setInputText(corrections[index].orig_sentence)
    setCorrectedText(corrections[index].corr_sentence)
    setGroupedResults([corrections[index]])
    setCorrectionId([corrections[index].id])
  }

  const handleSaveCorrection = async () => {
    const userId = session?.user?.user_id
    if (!userId) {
      setSaveStatus("error")
      setSaveMessage("Login required to save correction.")
      return
    }
    if (!correctionId.length) {
      setSaveStatus("error")
      setSaveMessage("Missing correction ID. Please run correction again.")
      return
    }

    try {
      setSaveStatus("saving")
      setSaveMessage("")      
      const request = await fetch(`${backendBaseUrl}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, correction_id: correctionId }),
      })
      const response = await request.json()
      if (response.status.code !== 200) {
        throw new Error("Failed to save correction.")
      }
      setSaveStatus("success")
      setSaveMessage("Correction saved.")
    } catch (error) {
      setSaveStatus("error")
      setSaveMessage(error instanceof Error ? error.message : "Failed to save correction.")
    }
  }

  const groupedVoice = useMemo(
    () =>
      groupedResults.map((g, idx) => ({
        index: idx,
        corrected: g.corr_sentence,
        voice: g.voice_type,
        voice_analysis: g.voice_analysis,
      })),
    [groupedResults],
  )

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="container mx-auto max-w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Tugas Akhir</h1>
            <p className="text-xl text-gray-600">SISTEM GRAMMATICAL ERROR CORRECTION BAHASA INGGRIS</p>
            <p className="text-md text-gray-600">BAGI PELAJAR ESL DENGAN PENDEKATAN SEQUENCE TAGGING DAN FINE-TUNING</p>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Text Correction
                </CardTitle>
                <CardDescription>Enter your text below</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4 rounded-md border bg-white p-3">
                  <div>
                    <Label className="text-base font-medium">Input Mode</Label>
                    <p className="text-sm text-gray-500">
                      {useFileInput ? "Upload a .txt file" : "Type or paste your text"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Text</span>
                    <Switch checked={useFileInput} onCheckedChange={setUseFileInput} aria-label="Use .txt file input" />
                    <span className="text-sm text-gray-600">.txt file</span>
                  </div>
                </div>

                {useFileInput && (
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleFileChange}
                    className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
                    aria-label="Upload .txt file"
                  />
                )}
                {fileName && (
                  <div className="text-sm text-gray-600">
                    Loaded file: <span className="font-medium text-gray-800">{fileName}</span>
                  </div>
                )}
                {fileError && <p className="text-sm text-red-600">{fileError}</p>}

                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label htmlFor="input-text" className="text-base font-medium">
                      Original Text
                    </Label>

                    <Textarea
                      id="input-text"
                      placeholder="Enter your text to correct..."
                      value={inputText}
                      disabled={useFileInput}
                      onChange={(e) => setInputText(e.target.value)}
                      className="min-h-[200px] resize-none"
                    />
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCorrection}
                          disabled={!inputText.trim() || isProcessing}
                          className="flex-1"
                        >
                          {isProcessing ? "Processing..." : "Correct Grammar"}
                        </Button>
                        <Button variant="outline" onClick={clearAll} disabled={!inputText && !correctedText}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-medium">Corrected Text</Label>
                    {correctedText ? (
                      <div className="space-y-3">
                        <div className="min-h-[200px] p-3 border rounded-md bg-green-50 border-green-200">
                          <div className="space-y-2">
                            <p className="text-sm text-green-700 font-medium">✓ Grammar corrected</p>
                            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{correctedText}</p>
                          </div>
                        </div>
                        <div className="flex sm:flex-row gap-2">
                          <Button
                            variant="outline"
                            onClick={() => navigator.clipboard.writeText(correctedText)}
                            className="sm:flex-1"
                          >
                            Copy Corrected Text
                          </Button>
                          <Button onClick={downloadCorrected} className="sm:flex-1">
                            Download .txt
                          </Button>
                          
                        </div>
                        {isLoggedIn && (
                          <Button
                            variant={"secondary"}
                            onClick={handleSaveCorrection}
                            disabled={saveStatus === "saving"}
                            className="sm:flex-1"
                          >
                            {saveStatus === "saving" ? "Saving..." : "Save Correction"}
                          </Button>
                        )}
                        {isLoggedIn && saveMessage && (
                          <p className={`text-sm ${saveStatus === "success" ? "text-green-700" : "text-red-600"}`}>
                            {saveMessage}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="min-h-[200px] max-h-72 overflow-auto rounded-md border bg-gray-50 p-3 whitespace-pre-wrap text-sm text-gray-800">
                        <span className="text-gray-500 italic">Corrected text will appear here...</span>
                      </div>
                    )}
                  </div>
                </div>

                {(groupedResults.length > 0) && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <Label className="text-base font-medium">Error Explanations</Label>
                      <Button variant="ghost" onClick={() => setShowErrorExplanation((prev) => !prev)}>
                        {showErrorExplanation ? "Hide" : "Show"}
                      </Button>
                    </div>
                    <div className={(showErrorExplanation ? "space-y-4" : "hidden")}>
                      {groupedResults.map((g, idx) => (
                        <Card key={idx} className={(g.correction_details.length > 0) ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600">Sentence {idx + 1}</p>
                              {(g.correction_details.length > 0 && 
                                <span className="text-xs text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                                  {g.correction_details.length} correction{g.correction_details.length === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                            <div className="rounded-md border bg-white p-3">
                              <p className="text-sm text-gray-500 mb-1 font-medium">Original sentence</p>
                              <p className="text-gray-900">{g.orig_sentence}</p>
                            </div>
                            {(g.correction_details.length > 0 && 
                              <div className="rounded-md border bg-white p-3">
                                <p className="text-sm text-gray-500 mb-1 font-medium">Corrected sentence</p>
                                <p className="text-gray-900">{g.corr_sentence}</p>
                              </div>
                            )}

                            {g.correction_details.length > 0 ? (
                              <div className="space-y-3">
                                {g.correction_details.map((err, detailIndex) => (
                                  <div key={detailIndex} className="border-l-4 border-amber-400 pl-4 py-2">
                                    <div className="flex items-start gap-3">
                                      <div className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-full">
                                        {err.error_type}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-mono">
                                            {g.orig_sentence
                                              .split(" ")
                                              .slice(
                                                err.orig_start > 0 && err.orig_start === err.orig_end
                                                  ? err.orig_start - 1
                                                  : err.orig_start,
                                                err.orig_start === err.orig_end ? err.orig_end + 1 : err.orig_end,
                                              )
                                              .join(" ")}
                                          </span>
                                          <span className="text-gray-500">→</span>
                                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-mono">
                                            {g.corr_sentence
                                              .split(" ")
                                              .slice(
                                                err.corr_start > 0 && err.corr_start === err.corr_end
                                                  ? err.corr_start - 1
                                                  : err.corr_start,
                                                err.corr_start === err.corr_end ? err.corr_end + 1 : err.corr_end,
                                              )
                                              .join(" ")}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-700">{err.explanation}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 italic">Your sentence is correct.</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {correctedText && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <Label className="text-base font-medium">Voice Analysis</Label>
                      <Button variant="ghost" onClick={() => setShowVoiceAnalysis((prev) => !prev)}>
                        {showVoiceAnalysis ? "Hide" : "Show"}
                      </Button>
                    </div>
                    <div className={(showVoiceAnalysis ? "space-y-4" : "hidden")}>
                      {groupedVoice.map((g) => (
                        <Card key={g.index} className="bg-purple-50 border-purple-200">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600">Sentence {g.index + 1}</p>
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  g.voice === "passive"
                                    ? "bg-purple-200 text-purple-800"
                                    : "bg-green-200 text-green-800"
                                }`}
                              >
                                Detected: {g.voice === "passive" ? "Passive" : "Active"}
                              </span>
                            </div>
                            <div className="rounded-md border bg-white p-3">
                              <p className="text-sm text-gray-500 mb-1 font-medium">Corrected sentence</p>
                              <p className="text-gray-900">{groupedResults[g.index].corr_sentence}</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full inline-block">
                                  Passive Voice
                                </div>
                                <div className="bg-white border border-purple-200 rounded-lg p-3">
                                  <p className="text-sm text-gray-600 mb-2 font-medium">Example:</p>
                                  <p className="text-gray-800 mb-2">
                                    {g.voice === "passive"
                                      ? groupedResults[g.index].corr_sentence
                                      : groupedResults[g.index].voice_analysis}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {"\u2022"} Subject receives the action {"\u2022"} Often uses "was/were" + past
                                    participle {"\u2022"} Can make writing less direct
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full inline-block">
                                  Active Voice
                                </div>
                                <div className="bg-white border border-green-200 rounded-lg p-3">
                                  <p className="text-sm text-gray-600 mb-2 font-medium">Example:</p>
                                  <p className="text-gray-800 mb-2">
                                    {g.voice === "active"
                                      ? groupedResults[g.index].corr_sentence
                                      : groupedResults[g.index].voice_analysis}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {"\u2022"} Subject performs the action {"\u2022"} More direct and engaging {"\u2022"}
                                    Generally preferred in writing
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Automatically detects and corrects grammar, punctuation, and capitalization errors</li>
                    <li>• Provides detailed explanations for each correction made</li>
                    <li>• Works with both individual sentences and longer paragraphs</li>
                    <li>• Upload a .txt file and download the corrected output as .txt</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            {isLoggedIn && (
            <aside className="space-y-6 w-full">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-base font-medium">Saved</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setShowSavedSection((prev) => !prev)}>
                      {showSavedSection ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleViewSavedCorrections}
                      disabled={savedStatus === "loading" || status === "loading"}
                    >
                      {savedStatus === "loading" ? "Loading..." : "View"}
                    </Button>
                  </div>
                </div>

                {showSavedSection && savedMessage && (
                  <p className={`text-sm ${savedStatus === "error" ? "text-red-600" : "text-gray-600"}`}>
                    {savedMessage}
                  </p>
                )}

                {showSavedSection && savedCorrections.length > 0 && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {savedCorrections.map((item, idx) => {
                        const previewText = item.corr_sentence
                        const isSelected = selectedSavedIndex === idx

                        return (
                          <button
                            key={`${item.id ?? "saved"}-${idx}`}
                            type="button"
                            onClick={() => handleSelectSavedCorrection(idx)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                                : "border-slate-200 bg-white text-gray-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">Saved #{idx + 1}</span>
                              {item.id && (
                                <span className="text-xs text-slate-500">{String(item.id)}</span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                              {previewText || "No preview available."}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-base font-medium">History</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setShowHistorySection((prev) => !prev)}>
                      {showHistorySection ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleViewHistory}
                      disabled={historyStatus === "loading" || status === "unauthenticated"}
                    >
                      {historyStatus === "loading" ? "Loading..." : "View"}
                    </Button>
                  </div>
                </div>

                {showHistorySection && historyMessage && (
                  <p className={`text-sm ${historyStatus === "error" ? "text-red-600" : "text-gray-600"}`}>
                    {historyMessage}
                  </p>
                )}

                {showHistorySection && historyCorrections.length > 0 && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {historyCorrections.map((item, idx) => {
                        const isSelected = selectedHistoryIndex === idx

                        return (
                          <button
                            key={`${item.id ?? "history"}-${idx}`}
                            type="button"
                            onClick={() => handleSelectHistoryCorrection(idx)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                : "border-slate-200 bg-white text-gray-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.orig_sentence}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                              {item.corr_sentence}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </aside>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
