'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { authApi, projectsApi, filesApi, analysisApi, artifactsApi, messagesApi } from '@/lib/api-client';

export default function DashboardPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [guidelines, setGuidelines] = useState<File | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [analysisStatus, setAnalysisStatus] = useState<any>(null);
  const [finalizeStatus, setFinalizeStatus] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rigidResponse, setRigidResponse] = useState<any>(null);
  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Status visibility and animations
  const [showAnalysisStatus, setShowAnalysisStatus] = useState(true);
  const [showFinalizeStatus, setShowFinalizeStatus] = useState(true);
  const [analysisGreenFlash, setAnalysisGreenFlash] = useState(false);
  const [finalizeGreenFlash, setFinalizeGreenFlash] = useState(false);
  // Resizable panels
  const [sidebarWidth, setSidebarWidth] = useState(312);
  const [rightPanelWidth, setRightPanelWidth] = useState(752);
  const [audioSectionHeight, setAudioSectionHeight] = useState(487);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGuidelines(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setGuidelines(e.dataTransfer.files[0]);
    }
  };

  // Check auth on mount and load projects
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authApi.getMe();
        setUser(userData);
        
        // Load user's projects
        const projectsData = await projectsApi.list({ limit: 20 });
        setProjects(projectsData.items);
      } catch (error) {
        router.push('/signin');
      }
    };
    checkAuth();
  }, [router]);

  // Poll analysis status if there's an active analysis
  useEffect(() => {
    if (!currentProject?.id || !analysisStatus) return;

    // Check initial status - if already done, load messages immediately
    if (analysisStatus.status === 'done') {
      (async () => {
        try {
          const messagesData = await messagesApi.list(currentProject.id, { limit: 50 });
          setMessages(messagesData.items);
        } catch (err) {
          console.error('Error loading messages:', err);
        }
      })();
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const status = await analysisApi.getStatus(analysisStatus.id);
        setAnalysisStatus(status);
        
        if (status.status === 'done') {
          clearInterval(pollInterval);
          // Load messages when analysis is complete
          if (currentProject?.id) {
            try {
              const messagesData = await messagesApi.list(currentProject.id, { limit: 50 });
              setMessages(messagesData.items);
            } catch (err) {
              console.error('Error loading messages:', err);
            }
          }
          // Fetch artifacts
          try {
            const artifactsData = await artifactsApi.list(status.id);
            setArtifacts(artifactsData.artifacts);
          } catch (err) {
            console.error('Error fetching artifacts:', err);
          }
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setError(status.failureReason || 'Analysis failed');
        }
      } catch (err) {
        console.error('Error polling analysis status:', err);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [currentProject?.id, analysisStatus?.id]);

  // Poll finalize status if there's an active finalize job
  useEffect(() => {
    if (!finalizeStatus) return;

      // Check initial status - if already done, load artifacts immediately
      if (finalizeStatus.status === 'done') {
        (async () => {
          try {
            const artifactsData = await artifactsApi.list(finalizeStatus.id);
            setArtifacts(artifactsData.artifacts);
            setLoading(false);
            // Fetch rigid response for chat context
            try {
              const result = await analysisApi.getResult(finalizeStatus.id);
              if (result.responseJson) {
                setRigidResponse(result.responseJson);
              }
            } catch (err) {
              console.error('Error fetching rigid response:', err);
            }
          } catch (err) {
            console.error('Error loading artifacts:', err);
          }
        })();
        return;
      }

    const pollInterval = setInterval(async () => {
      try {
        const status = await analysisApi.getStatus(finalizeStatus.id);
        setFinalizeStatus(status);
        
        if (status.status === 'done') {
          clearInterval(pollInterval);
          setLoading(false);
          // Fetch artifacts when finalize is complete
          try {
            const artifactsData = await artifactsApi.list(status.id);
            setArtifacts(artifactsData.artifacts);
          } catch (err) {
            console.error('Error fetching artifacts:', err);
          }
          // Fetch rigid response for chat context
          try {
            const result = await analysisApi.getResult(status.id);
            if (result.responseJson) {
              setRigidResponse(result.responseJson);
            }
          } catch (err) {
            console.error('Error fetching rigid response:', err);
          }
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setLoading(false);
          setError(status.failureReason || 'Finalization failed');
        }
      } catch (err) {
        console.error('Error polling finalize status:', err);
        clearInterval(pollInterval);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [finalizeStatus?.id]);

  // Auto-scroll chat to bottom when messages change (only within chat container)
  useEffect(() => {
    if (messagesEndRef.current) {
      // Only scroll the chat container, not the main page
      const chatContainer = messagesEndRef.current.closest('.chat-messages-container');
      if (chatContainer) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [messages, chatLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [chatInput]);

  // Scroll to top when analysis starts
  useEffect(() => {
    if (analysisStatus) {
      // Scroll main content to top when analysis status appears
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [analysisStatus?.id]);

  // Handle analysis status done - green flash and auto-hide
  useEffect(() => {
    if (analysisStatus?.status === 'done' && showAnalysisStatus) {
      setAnalysisGreenFlash(true);
      const flashTimer = setTimeout(() => {
        setAnalysisGreenFlash(false);
      }, 2000); // 2 seconds green flash
      
      const hideTimer = setTimeout(() => {
        setShowAnalysisStatus(false);
      }, 4000); // Hide after 4 seconds total
      
      return () => {
        clearTimeout(flashTimer);
        clearTimeout(hideTimer);
      };
    } else if (analysisStatus?.status !== 'done') {
      setShowAnalysisStatus(true);
      setAnalysisGreenFlash(false);
    }
  }, [analysisStatus?.status]);

  // Handle finalize status done - green flash and auto-hide
  useEffect(() => {
    if (finalizeStatus?.status === 'done' && showFinalizeStatus) {
      setFinalizeGreenFlash(true);
      const flashTimer = setTimeout(() => {
        setFinalizeGreenFlash(false);
      }, 2000); // 2 seconds green flash
      
      const hideTimer = setTimeout(() => {
        setShowFinalizeStatus(false);
      }, 4000); // Hide after 4 seconds total
      
      return () => {
        clearTimeout(flashTimer);
        clearTimeout(hideTimer);
      };
    } else if (finalizeStatus?.status !== 'done') {
      setShowFinalizeStatus(true);
      setFinalizeGreenFlash(false);
    }
  }, [finalizeStatus?.status]);

  // Resize handlers
  const handleMouseDown = (type: string) => {
    setIsResizing(type);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      if (isResizing === 'sidebar') {
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        setSidebarWidth(newWidth);
      } else if (isResizing === 'rightPanel') {
        const newWidth = Math.max(400, Math.min(1000, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
      } else if (isResizing === 'audioSection') {
        const rightPanel = document.querySelector('aside[class*="border-l-8"]');
        if (rightPanel) {
          const rect = rightPanel.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const newHeight = Math.max(200, Math.min(600, relativeY - 50)); // Account for top tab
          setAudioSectionHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = isResizing === 'audioSection' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  // Reset chat state when creating new project
  useEffect(() => {
    if (!currentProject) {
      setMessages([]);
      setChatInput('');
      setChatLoading(false);
      setRigidResponse(null);
      setAnalysisStatus(null);
      setFinalizeStatus(null);
      setArtifacts([]);
    }
  }, [currentProject]);

  // Load project data when a project is selected
  const loadProjectData = async (projectId: string) => {
    try {
      // Load messages
      try {
        const messagesData = await messagesApi.list(projectId, { limit: 50 });
        setMessages(messagesData.items);
      } catch (err) {
        console.error('Error loading messages:', err);
        setMessages([]);
      }

      // Load analyses
      try {
        const analysesData = await projectsApi.getAnalyses(projectId);
        
        // Set exploratory analysis status if it exists
        if (analysesData.exploratoryAnalysis) {
          setAnalysisStatus({
            id: analysesData.exploratoryAnalysis.id,
            status: analysesData.exploratoryAnalysis.status,
            kind: analysesData.exploratoryAnalysis.kind,
            startedAt: analysesData.exploratoryAnalysis.startedAt,
            finishedAt: analysesData.exploratoryAnalysis.finishedAt,
            failureReason: analysesData.exploratoryAnalysis.failureReason,
          });
        } else {
          setAnalysisStatus(null);
        }

        // Set finalize analysis status if it exists
        if (analysesData.finalizeAnalysis) {
          setFinalizeStatus({
            id: analysesData.finalizeAnalysis.id,
            status: analysesData.finalizeAnalysis.status,
            kind: analysesData.finalizeAnalysis.kind,
            startedAt: analysesData.finalizeAnalysis.startedAt,
            finishedAt: analysesData.finalizeAnalysis.finishedAt,
            failureReason: analysesData.finalizeAnalysis.failureReason,
          });

          // Load artifacts for finalize analysis
          if (analysesData.finalizeAnalysis.status === 'done') {
            try {
              const artifactsData = await artifactsApi.list(analysesData.finalizeAnalysis.id);
              setArtifacts(artifactsData.artifacts);
            } catch (err) {
              console.error('Error loading artifacts:', err);
              setArtifacts([]);
            }

            // Load rigid response for chat context
            try {
              const result = await analysisApi.getResult(analysesData.finalizeAnalysis.id);
              if (result.responseJson) {
                setRigidResponse(result.responseJson);
              }
            } catch (err) {
              console.error('Error loading rigid response:', err);
            }
          } else {
            setArtifacts([]);
          }
        } else {
          setFinalizeStatus(null);
          setArtifacts([]);
        }
      } catch (err) {
        console.error('Error loading analyses:', err);
        setAnalysisStatus(null);
        setFinalizeStatus(null);
        setArtifacts([]);
      }
    } catch (err) {
      console.error('Error loading project data:', err);
    }
  };

  const handleGenerate = async () => {
    if (!brandName || !website) {
      setError('Brand name and website are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create project
      const project = await projectsApi.create({
        brandName,
        brandWebsite: website,
      });
      setCurrentProject(project);

      // Upload file if provided
      if (guidelines) {
        try {
          // Get presigned URL
          const presign = await filesApi.presign({
            projectId: project.id,
            filename: guidelines.name,
            mimeType: guidelines.type,
            sizeBytes: guidelines.size,
          });

          // Upload to S3
          await filesApi.upload(presign.uploadUrl, guidelines);

          // Register file
          await filesApi.register({
            projectId: project.id,
            s3Key: presign.s3Key,
            filename: guidelines.name,
            mimeType: guidelines.type,
            sizeBytes: guidelines.size,
          });
        } catch (fileError: any) {
          console.error('File upload error:', fileError);
          // Continue even if file upload fails
        }
      }

      // Start exploratory analysis
      const analysis = await analysisApi.start({
        projectId: project.id,
        seedPrompt: `Analyze the brand ${brandName} with website ${website}`,
      });
      setAnalysisStatus(analysis);
      
      // If analysis is already done (shouldn't happen but handle it), load messages
      if (analysis.status === 'done') {
        try {
          const messagesData = await messagesApi.list(project.id, { limit: 50 });
          setMessages(messagesData.items);
        } catch (err) {
          console.error('Error loading messages:', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate audio branding');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!analysisStatus || analysisStatus.status !== 'done') {
      setError('Analysis must be completed before finalizing');
      return;
    }

    // Don't allow finalizing if there's already a finalize job in progress
    if (finalizeStatus?.status === 'running' || finalizeStatus?.status === 'pending') {
      setError('Finalization is already in progress. Please wait for it to complete.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use latest conversation (including chat messages) instead of static findingsDraft
      // This ensures re-finalization includes any updates from chat
      const finalizeResult = await analysisApi.finalize({
        analysisId: analysisStatus.id,
        useFindingsDraft: false, // Use conversation snapshot which includes latest chat
      });
      setFinalizeStatus(finalizeResult);
      // Reset artifacts when starting a new finalization
      setArtifacts([]);
      setAudioUrls({});
      setPdfUrl(null);
      setRigidResponse(null);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize');
      setLoading(false);
    }
  };

  const handleDownloadArtifact = async (artifactId: string, filename: string) => {
    try {
      const { downloadUrl } = await artifactsApi.getDownloadUrl(artifactId);
      window.open(downloadUrl, '_blank');
    } catch (err: any) {
      setError(err.message || 'Failed to download artifact');
    }
  };

  // Load audio URLs and PDF URL when artifacts change
  useEffect(() => {
    const loadArtifactUrls = async () => {
      const audioUrlMap: Record<string, string> = {};
      let pdfUrlValue: string | null = null;

      for (const artifact of artifacts) {
        try {
          const { downloadUrl, type } = await artifactsApi.getDownloadUrl(artifact.id);
          if (type === 'audio') {
            audioUrlMap[artifact.id] = downloadUrl;
          } else if (type === 'pdf') {
            pdfUrlValue = downloadUrl;
          }
        } catch (err) {
          console.error(`Error loading URL for artifact ${artifact.id}:`, err);
        }
      }

      setAudioUrls(audioUrlMap);
      setPdfUrl(pdfUrlValue);
    };

    if (artifacts.length > 0) {
      loadArtifactUrls();
    } else {
      setAudioUrls({});
      setPdfUrl(null);
    }
  }, [artifacts]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentProject?.id || chatLoading) return;

    const messageText = chatInput.trim();
    setChatInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setChatLoading(true);

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    const timestamp = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: 'user',
        content: { text: messageText },
        createdAt: timestamp,
        optimistic: true,
      },
      {
        id: tempAssistantId,
        role: 'assistant',
        content: { text: '', type: 'chat_response' },
        createdAt: timestamp,
        streaming: true,
      },
    ]);

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: { text: messageText },
          useFindingsDraft: false,
          rigidResponse: rigidResponse,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming response unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      const applyChunk = (dataStr: string) => {
        if (!dataStr || dataStr === '[DONE]') {
          return;
        }

        const payload = JSON.parse(dataStr);

        if (payload.type === 'ack' && payload.message) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === tempUserId ? payload.message : msg))
          );
        } else if (payload.type === 'token' && payload.content) {
          assistantContent += payload.content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? {
                    ...msg,
                    content: {
                      ...(msg.content || {}),
                      text: assistantContent,
                      type: 'chat_response',
                    },
                  }
                : msg
            )
          );
        } else if (payload.type === 'done' && payload.message) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === tempAssistantId ? payload.message : msg))
          );
        } else if (payload.type === 'error') {
          throw new Error(payload.error || 'Streaming error');
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawChunk = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);

          if (rawChunk.startsWith('data:')) {
            const dataStr = rawChunk.slice(5).trim();
            applyChunk(dataStr);
          }

          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (err: any) {
      console.error('Streaming chat error:', err);
      setError(err.message || 'Failed to send message');
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== tempUserId && msg.id !== tempAssistantId)
      );
    } finally {
      setChatLoading(false);
    }
  };

  const formatMessageContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (content?.text) {
      return content.text;
    }
    if (content?.type === 'analysis_complete') {
      return 'Analysis completed. See details below.';
    }
    if (content?.type === 'chat_response') {
      return content.text || '';
    }
    return JSON.stringify(content, null, 2);
  };

  const renderAnalysisResults = (content: any) => {
    if (content?.type !== 'analysis_complete' || !content.findings) {
      return null;
    }

    const findings = content.findings;
    return (
      <div className="space-y-3 mt-3 pt-3 border-t border-[rgba(255,255,255,0.1)]">
        {findings.positioning && (
          <div>
            <h4 className="text-white font-semibold mb-1 text-sm">Brand Positioning</h4>
            <div className="text-neutral-300 text-xs leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {findings.positioning}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {findings.target_audience && (
          <div>
            <h4 className="text-white font-semibold mb-1 text-sm">Target Audience</h4>
            <div className="text-neutral-300 text-xs leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {findings.target_audience}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {findings.tone_personality && (
          <div>
            <h4 className="text-white font-semibold mb-1 text-sm">Tone & Personality</h4>
            <div className="text-neutral-300 text-xs leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {findings.tone_personality}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {findings.visual_tactile_cues && (
          <div>
            <h4 className="text-white font-semibold mb-1 text-sm">Visual & Tactile Cues</h4>
            <div className="text-neutral-300 text-xs leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {findings.visual_tactile_cues}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {findings.brand_promise && (
          <div>
            <h4 className="text-white font-semibold mb-1 text-sm">Brand Promise</h4>
            <div className="text-neutral-300 text-xs leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {findings.brand_promise}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {findings.practical_constraints && (
          <div>
            <h4 className="text-white font-semibold mb-1 text-sm">Practical Constraints</h4>
            <div className="text-neutral-300 text-xs leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {findings.practical_constraints}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#191919] text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarCollapsed ? 'w-[80px]' : ''} border-r border-[#4c4b4b] flex flex-col h-screen transition-all duration-300 relative`}
        style={{ 
          width: sidebarCollapsed ? '80px' : `${sidebarWidth}px`,
          background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)' 
        }}
      >
        {!sidebarCollapsed && (
          <div
            className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-[#d75c35] transition-colors z-20"
            onMouseDown={(e) => {
              e.preventDefault();
              handleMouseDown('sidebar');
            }}
          />
        )}
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          {/* Logo Bar */}
          {!sidebarCollapsed ? (
            <div className="h-[50px] w-full relative flex items-center">
              <div className="h-[45px] w-full bg-[#d9d9d9] rounded-[50px] overflow-hidden relative">
                <Image
                  src="/assets/logo-bg.png"
                  alt="Background"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute left-[15px] h-[40px] w-[120px]">
                <Image
                  src="/assets/logo.svg"
                  alt="Aalap.ai"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="w-[40px] h-[40px] bg-[#d9d9d9] rounded-full overflow-hidden relative mx-auto">
              <Image
                src="/assets/logo-bg.png"
                alt="Background"
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Sidebar Toggle */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-[#2a2a2a] transition-colors ml-2"
            >
              <Image
                src="/assets/sidebar-toggle.svg"
                alt="Menu"
                width={20}
                height={20}
              />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 mx-auto mb-4 rounded hover:bg-[#2a2a2a] transition-colors"
          >
            <Image
              src="/assets/sidebar-toggle.svg"
              alt="Menu"
              width={20}
              height={20}
            />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-[10px] pt-[62px] space-y-[62px] overflow-y-auto min-h-0">
          {/* Nav Tools */}
          <div className="space-y-0">
            <button
              onClick={() => {
                setCurrentProject(null);
                setSelectedProject(null);
                setBrandName('');
                setWebsite('');
                setGuidelines(null);
                setAnalysisStatus(null);
                setFinalizeStatus(null);
                setArtifacts([]);
                setError(null);
                setMessages([]);
                setChatInput('');
                setChatLoading(false);
                setRigidResponse(null);
              }}
              className={`flex items-center gap-[14px] w-full text-left px-[10px] py-[10px] rounded-[10px] hover:bg-[#2a2a2a] ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Image
                src="/assets/createNew.svg"
                alt=""
                width={20}
                height={20}
              />
              {!sidebarCollapsed && (
                <span className="text-white text-[16px]" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Create New
                </span>
              )}
            </button>

            <button className={`flex items-center gap-[14px] w-full text-left px-[10px] py-[10px] rounded-[10px] ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <Image
                src="/assets/search.svg"
                alt=""
                width={20}
                height={20}
              />
              {!sidebarCollapsed && (
                <span className="text-white text-[16px]" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Search Workspace
                </span>
              )}
            </button>

            <button className={`flex items-center gap-[14px] w-full text-left px-[10px] py-[10px] rounded-[10px] ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <Image
                src="/assets/library.svg"
                alt=""
                width={20}
                height={20}
              />
              {!sidebarCollapsed && (
                <span className="text-white text-[16px]" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Library
                </span>
              )}
            </button>
          </div>

          {/* Workspace */}
          {!sidebarCollapsed && (
            <div className="space-y-2">
              <p className="text-[#6f6f6f] text-[16px] px-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                Workspace
              </p>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={async () => {
                    setSelectedProject(project.id);
                    setCurrentProject(project);
                    setBrandName(project.brandName);
                    setWebsite(project.brandWebsite);
                    // Load messages and artifacts for this project
                    await loadProjectData(project.id);
                  }}
                  className={`w-full text-left px-[10px] py-[10px] rounded-[10px] hover:bg-[#2a2a2a] ${
                    selectedProject === project.id ? 'bg-[#2a2a2a]' : ''
                  }`}
                >
                  <span className="text-white text-[16px]" style={{ fontFamily: 'var(--font-poppins)' }}>
                    {project.brandName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#4c4b4b] p-[4px]">
          <div className={`flex items-center gap-3 p-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-[40px] h-[40px] rounded-full bg-[#d75c35] flex items-center justify-center">
              <span className="text-white text-[18px] font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                P
              </span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <p className="text-white text-[14px] truncate" style={{ fontFamily: 'var(--font-poppins)' }}>
                  {user?.email || user?.name || 'User'}
                </p>
                <button
                  onClick={async () => {
                    await authApi.logout();
                  }}
                  className="text-[#8c8c8c] text-xs mt-1 hover:text-white"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" style={{ background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)' }}>
        <div className="max-w-[792px] mx-auto py-[23px] px-8">
          {/* Show brand name at top when analysis has started - sticky to keep visible */}
          {analysisStatus && brandName && (
            <div className="mb-6 sticky top-0 bg-[rgba(31,31,31,0.95)] backdrop-blur-sm z-10 pb-4 pt-2 -mt-2 -mx-2 px-2">
              <h1 className="text-[44px] leading-[1.28] tracking-[-1.76px] text-white" style={{ fontFamily: 'var(--font-poppins)' }}>
                {brandName}
              </h1>
            </div>
          )}

          {/* Form - only show when no analysis has started */}
          {!analysisStatus && (
            <>
              {/* Header */}
              <div className="mb-[79px]">
                <div className="flex items-end gap-[15px] mb-1">
                  <h1 className="text-[44px] leading-[1.28] tracking-[-1.76px]" style={{ fontFamily: 'var(--font-poppins)' }}>
                    Brand
                  </h1>
                  <h1 className="text-[50px] leading-[1.28] italic" style={{ fontFamily: 'Times New Roman, serif' }}>
                    details
                  </h1>
                </div>
                <p className="text-[#6f6f6f] text-[18px] leading-[1.32]" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Audio Branding
                </p>
              </div>

              {/* Form */}
              <div className="space-y-[30px] mb-[99px]">
            {/* Brand Name */}
            <div className="space-y-[10px]">
              <label className="block text-white text-[18px] leading-[1.32]" style={{ fontFamily: 'var(--font-poppins)' }}>
                Brand Name
              </label>
              <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-[13px]">
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="What is your brand called?"
                  className="bg-transparent border-none outline-none text-white text-[16px] w-full placeholder-[#6f6f6f]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                />
              </div>
            </div>

            {/* Website */}
            <div className="space-y-[10px]">
              <label className="block text-white text-[18px] leading-[1.32]" style={{ fontFamily: 'var(--font-poppins)' }}>
                Your Website
              </label>
              <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-[13px]">
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Enter your brand's website URL"
                  className="bg-transparent border-none outline-none text-white text-[16px] w-full placeholder-[#6f6f6f]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                />
              </div>
            </div>

            {/* Brand Guidelines */}
            <div className="space-y-[10px]">
              <label className="block text-white text-[18px] leading-[1.32]" style={{ fontFamily: 'var(--font-poppins)' }}>
                Brand Guidelines (Optional)
              </label>
              <div
                className="border-2 border-dashed border-[#8c8c8c] rounded-[10px] h-[445px] bg-[#1f1f1f] flex items-center justify-center relative"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="text-center space-y-[119px]">
                  <div className="space-y-[14px]">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="bg-[#d75c35] border border-[#df7d5d] rounded-[10px] px-[38px] py-[16px] inline-flex items-center gap-[14px]">
                        <Image
                          src="/assets/upload-icon.svg"
                          alt="Upload"
                          width={28}
                          height={28}
                        />
                        <span className="text-white text-[22px] leading-[1.24]" style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600 }}>
                          Upload
                        </span>
                      </div>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <p className="text-[rgba(255,255,255,0.8)] text-[20px] leading-[1.44]" style={{ fontFamily: 'var(--font-poppins)' }}>
                      or drag & drop
                    </p>
                  </div>
                  <p className="text-[rgba(255,255,255,0.6)] text-[18px] leading-[1.32]" style={{ fontFamily: 'var(--font-poppins)' }}>
                    only PDF, Doc are supported upto 200 Mb
                  </p>
                </div>
                {guidelines && (
                  <div className="absolute top-4 left-4 text-white text-sm">
                    Uploaded: {guidelines.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-[10px] text-red-400">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!brandName || !website || loading}
            className={`rounded-[10px] px-[40px] py-[15px] flex items-center justify-center gap-[10px] transition-all duration-200 ${
              brandName && website && !loading
                ? 'bg-[#d75c35] border border-[#df7d5d] hover:bg-[#c54a25] cursor-pointer'
                : 'bg-[rgba(255,255,255,0.2)] border border-transparent opacity-50 cursor-not-allowed'
            }`}
          >
            <span className={`text-[22px] leading-[1.24] ${
              brandName && website && !loading ? 'text-white' : 'text-[#8c8c8c]'
            }`} style={{ fontFamily: 'var(--font-poppins)', fontWeight: 600 }}>
              {loading ? 'Processing...' : 'Generate Audio Branding'}
            </span>
            {!loading && (
              <Image
                src="/assets/arrow-icon.svg"
                alt="Arrow"
                width={18}
                height={21}
                className={`rotate-90 ${
                  brandName && website ? 'opacity-100' : 'opacity-50'
                }`}
              />
            )}
          </button>
            </>
          )}

          {/* Analysis Status */}
          {analysisStatus && showAnalysisStatus && (
            <div 
              className={`mt-4 p-4 rounded-[10px] transition-all duration-500 ${
                analysisGreenFlash 
                  ? 'bg-green-600' 
                  : analysisStatus.status === 'done' 
                    ? 'bg-green-500/20 border border-green-500/50' 
                    : 'bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              <p className="text-white mb-2">
                Analysis Status: <span className="capitalize">{analysisStatus.status}</span>
                {analysisStatus.status === 'pending' && ' (Waiting to start...)'}
                {analysisStatus.status === 'running' && ' (Processing...)'}
              </p>
              {analysisStatus.status === 'running' && (
                <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2 mb-2">
                  <div 
                    className="bg-[#d75c35] h-2 rounded-full transition-all duration-300 animate-pulse"
                    style={{ width: '60%' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Finalize Status */}
          {finalizeStatus && showFinalizeStatus && (
            <div 
              className={`mt-4 p-4 rounded-[10px] transition-all duration-500 ${
                finalizeGreenFlash 
                  ? 'bg-green-600' 
                  : finalizeStatus.status === 'done' 
                    ? 'bg-green-500/20 border border-green-500/50' 
                    : 'bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              <p className="text-white mb-2">
                Finalize Status: <span className="capitalize">{finalizeStatus.status}</span>
                {finalizeStatus.status === 'pending' && ' (Queued...)'}
                {finalizeStatus.status === 'running' && ' (Generating audio files and PDF...)'}
                {finalizeStatus.status === 'done' && ' (Complete! Check artifacts panel)'}
                {finalizeStatus.status === 'failed' && ' (Failed - see error above)'}
              </p>
              {finalizeStatus.status === 'running' && (
                <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2 mb-2">
                  <div 
                    className="bg-[#d75c35] h-2 rounded-full transition-all duration-300 animate-pulse"
                    style={{ width: `${finalizeStatus.progress || 0}%` }}
                  />
                </div>
              )}
              {finalizeStatus.status === 'running' && finalizeStatus.progress !== undefined && (
                <p className="text-neutral-400 text-xs mt-1">
                  {finalizeStatus.progress}% complete ({Math.floor((finalizeStatus.progress || 0) / 20)}/5 audio files generated)
                </p>
              )}
              {finalizeStatus.status === 'done' && artifacts.length > 0 && (
                <p className="text-green-400 text-sm mt-2">
                  ✓ {artifacts.length} artifact(s) generated successfully
                </p>
              )}
            </div>
          )}

          {/* Chat Interface - show when analysis has started */}
          {analysisStatus && currentProject?.id && (
            <div className={analysisStatus.status === 'done' ? 'mt-6' : 'mt-6'}>
              {(analysisStatus.status === 'done' || finalizeStatus?.status === 'done') && (
                <h2 className="text-white text-xl mb-4" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Chat with Your Brand Analysis
                </h2>
              )}
              {analysisStatus.status !== 'done' && !finalizeStatus && (
                <h2 className="text-white text-xl mb-4" style={{ fontFamily: 'var(--font-poppins)' }}>
                  Analysis in Progress...
                </h2>
              )}
              
              {/* Messages Display */}
              <div className="chat-messages-container h-[400px] overflow-y-auto mb-4 space-y-4 bg-[rgba(255,255,255,0.03)] rounded-[10px] p-4">
                {messages.length === 0 && (analysisStatus.status === 'done' || finalizeStatus?.status === 'done') ? (
                  <p className="text-neutral-400 text-center">No messages yet. Start a conversation!</p>
                ) : messages.length === 0 && analysisStatus.status !== 'done' && !finalizeStatus ? (
                  <p className="text-neutral-400 text-center">Analysis is running. Messages will appear here once complete.</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-[10px] p-3 ${
                          message.role === 'user'
                            ? 'bg-[#d75c35] text-white'
                            : 'bg-[rgba(255,255,255,0.1)] text-white'
                        }`}
                      >
                        <div className="text-sm mb-1 opacity-70">
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className="text-sm prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="ml-2">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              code: ({ children }) => <code className="bg-[rgba(255,255,255,0.1)] px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                              pre: ({ children }) => <pre className="bg-[rgba(255,255,255,0.1)] p-2 rounded mb-2 overflow-x-auto">{children}</pre>,
                            }}
                          >
                            {formatMessageContent(message.content)}
                          </ReactMarkdown>
                        </div>
                        {renderAnalysisResults(message.content)}
                        <div className="text-xs mt-2 opacity-50">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[rgba(255,255,255,0.1)] rounded-[10px] p-3">
                      <div className="text-sm text-neutral-400">Assistant is typing...</div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input - always show when analysis is done, even after finalization */}
              {(analysisStatus.status === 'done' || finalizeStatus?.status === 'done') && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={textareaRef}
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        // Auto-resize
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      rows={1}
                      className="flex-1 bg-[rgba(255,255,255,0.03)] border border-[#4c4b4b] rounded-[10px] px-4 py-2 text-white placeholder-[#6f6f6f] outline-none focus:border-[#d75c35] resize-none overflow-hidden min-h-[44px] max-h-[200px]"
                      style={{ fontFamily: 'var(--font-poppins)' }}
                      disabled={chatLoading}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || chatLoading}
                      className="px-6 py-2 bg-[#d75c35] text-white rounded-[10px] hover:bg-[#c54a25] disabled:opacity-50 disabled:cursor-not-allowed h-[44px]"
                      style={{ fontFamily: 'var(--font-poppins)' }}
                    >
                      Send
                    </button>
                  </div>
                  {/* Show Finalize button - allow re-finalizing after completion */}
                  {analysisStatus?.status === 'done' && (
                    <button
                      onClick={handleFinalize}
                      disabled={loading || (finalizeStatus?.status === 'running' || finalizeStatus?.status === 'pending')}
                      className="w-full px-4 py-2 bg-[#d75c35] text-white rounded-[10px] hover:bg-[#c54a25] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'var(--font-poppins)' }}
                    >
                      {finalizeStatus?.status === 'done' 
                        ? 'Re-finalize (Generate New Audio + PDF)' 
                        : 'Finalize (Generate Audio + PDF)'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Right Panel */}
      <aside 
        className="border-l-8 border-[#353535] flex flex-col h-screen overflow-hidden relative" 
        style={{ 
          width: `${rightPanelWidth}px`,
          background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)' 
        }}
      >
        <div
          className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-[#d75c35] transition-colors z-20"
          onMouseDown={(e) => {
            e.preventDefault();
            handleMouseDown('rightPanel');
          }}
        />
        {/* Top Tab */}
        <div className="h-[50px] border-b border-[#6f6f6f] flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)' }}>
          <p className="text-neutral-400 text-[14px]" style={{ fontFamily: 'var(--font-poppins)' }}>
            Brand Audio
          </p>
        </div>

        {/* Content Area */}
        <div className="flex flex-col overflow-y-auto p-4 flex-shrink-0" style={{ height: `${audioSectionHeight}px`, maxHeight: `${audioSectionHeight}px` }}>
          {artifacts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-400 text-[20px] leading-[1.44] text-center max-w-[308px]" style={{ fontFamily: 'var(--font-poppins)' }}>
                It's empty . . . for now. Enter your brand details on the left to generate an audio identity.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-white text-lg mb-4">Generated Artifacts</h3>
              {artifacts
                .filter((artifact) => artifact.type === 'audio')
                .map((artifact) => (
                  <div
                    key={artifact.id}
                    className="p-4 bg-[rgba(255,255,255,0.05)] rounded-[10px]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-medium">{artifact.filename.replace(/\.(mp3|wav|m4a)$/i, '')}</p>
                        <p className="text-neutral-400 text-xs">{artifact.type}</p>
                      </div>
                      <button
                        onClick={() => handleDownloadArtifact(artifact.id, artifact.filename)}
                        className="px-3 py-1.5 bg-[#367aff] text-white rounded-[8px] hover:bg-[#2968e6] text-sm"
                      >
                        Download
                      </button>
                    </div>
                    {audioUrls[artifact.id] ? (
                      <audio
                        controls
                        className="w-full h-10"
                        style={{ 
                          filter: 'invert(1) hue-rotate(180deg)',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          borderRadius: '8px'
                        }}
                      >
                        <source src={audioUrls[artifact.id]} type="audio/mpeg" />
                        <source src={audioUrls[artifact.id]} type="audio/wav" />
                        <source src={audioUrls[artifact.id]} type="audio/mp4" />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <div className="text-neutral-400 text-sm">Loading audio...</div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Resize Handle for Audio Section */}
        <div
          className="h-1 cursor-row-resize hover:bg-[#d75c35] transition-colors relative flex-shrink-0"
          onMouseDown={(e) => {
            e.preventDefault();
            handleMouseDown('audioSection');
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-0.5 bg-[#6f6f6f] hover:bg-[#d75c35] transition-colors" />
          </div>
        </div>

        {/* Bottom Tab */}
        <div className="h-[50px] border-t border-[#6f6f6f] flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), linear-gradient(90deg, rgb(31, 31, 31) 0%, rgb(31, 31, 31) 100%)' }}>
          <p className="text-neutral-400 text-[14px]" style={{ fontFamily: 'var(--font-poppins)' }}>
            Brand Report
          </p>
        </div>

        {/* PDF Viewer Area */}
        <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ height: `calc(100vh - ${audioSectionHeight + 100}px)`, maxHeight: `calc(100vh - ${audioSectionHeight + 100}px)`, minHeight: '300px' }}>
          {pdfUrl ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-[#6f6f6f]">
                <p className="text-white text-sm" style={{ fontFamily: 'var(--font-poppins)' }}>
                  {artifacts.find(a => a.type === 'pdf')?.filename || 'Brand Report.pdf'}
                </p>
                <button
                  onClick={() => {
                    const pdfArtifact = artifacts.find(a => a.type === 'pdf');
                    if (pdfArtifact) {
                      handleDownloadArtifact(pdfArtifact.id, pdfArtifact.filename);
                    }
                  }}
                  className="px-4 py-2 bg-[#d75c35] text-white rounded-[8px] hover:bg-[#c54a25] text-sm flex items-center gap-2"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 11L8 1M8 11L5 8M8 11L11 8M2 13L14 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-[rgba(255,255,255,0.05)]">
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-400 text-center" style={{ fontFamily: 'var(--font-poppins)' }}>
                PDF report will appear here once generated
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
