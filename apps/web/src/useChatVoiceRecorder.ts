import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { t } from './i18n';
import { recordedBlobToWav } from './voiceNote';

type UseChatVoiceRecorderOptions = {
  conversationId?: string;
  busy: boolean;
  setFile: Dispatch<SetStateAction<File | undefined>>;
  setPendingId: Dispatch<SetStateAction<string | undefined>>;
  setError: Dispatch<SetStateAction<unknown>>;
};

const MAX_RECORDING_BYTES = 10 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 120;

export function useChatVoiceRecorder({
  conversationId,
  busy,
  setFile,
  setPendingId,
  setError,
}: UseChatVoiceRecorderOptions) {
  const [recording, setRecording] = useState(false);
  const [recordPaused, setRecordPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array(28).fill(0));
  const [processingAudio, setProcessingAudio] = useState(false);

  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const recordIntervalRef = useRef<number | undefined>(undefined);
  const waveIntervalRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const recordStartedRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pauseDurationRef = useRef(0);
  const recordGenerationRef = useRef(0);
  const requestingMicRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const releaseMicrophone = useCallback((updateState = true) => {
    clearInterval(recordIntervalRef.current);
    clearInterval(waveIntervalRef.current);
    void audioContextRef.current?.close();
    audioContextRef.current = undefined;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = undefined;
    recorderRef.current = undefined;
    if (updateState) {
      setRecording(false);
      setRecordPaused(false);
    }
  }, []);

  const stopRecording = useCallback((discard = false) => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (discard) recorder.onstop = null;
    if (recorder.state !== 'inactive') recorder.stop();
    if (discard) releaseMicrophone();
  }, [releaseMicrophone]);

  const toggleRecordPause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      pausedAtRef.current = Date.now();
      setRecordPaused(true);
    } else if (recorder.state === 'paused') {
      pauseDurationRef.current += Date.now() - pausedAtRef.current;
      recorder.resume();
      setRecordPaused(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!conversationId || recording || processingAudio || busy || requestingMicRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(new Error(t('Este navegador no permite grabar notas de voz.')));
      return;
    }

    requestingMicRef.current = true;
    const generation = recordGenerationRef.current;
    const currentConversation = conversationId;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (generation !== recordGenerationRef.current || conversationIdRef.current !== currentConversation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream);
      const parts: Blob[] = [];
      let recordedBytes = 0;
      recorder.ondataavailable = event => {
        if (!event.data.size) return;
        recordedBytes += event.data.size;
        if (recordedBytes > MAX_RECORDING_BYTES) {
          stopRecording(true);
          setError(new Error(t('La nota de voz supera el límite de 10 MB.')));
        } else {
          parts.push(event.data);
        }
      };
      recorder.onerror = () => {
        stopRecording(true);
        setError(new Error(t('No se pudo grabar la nota de voz.')));
      };
      recorder.onstop = () => {
        releaseMicrophone();
        if (generation !== recordGenerationRef.current || conversationIdRef.current !== currentConversation) return;
        setProcessingAudio(true);
        void recordedBlobToWav(new Blob(parts, { type: recorder.mimeType })).then(file => {
          if (generation === recordGenerationRef.current && conversationIdRef.current === currentConversation) {
            setFile(file);
            setPendingId(undefined);
            setError(undefined);
          }
        }).catch(() => {
          if (generation === recordGenerationRef.current && conversationIdRef.current === currentConversation) {
            setError(new Error(t('No se pudo preparar la nota de voz.')));
          }
        }).finally(() => {
          if (generation === recordGenerationRef.current && conversationIdRef.current === currentConversation) {
            setProcessingAudio(false);
          }
        });
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      setFile(undefined);
      setPendingId(undefined);
      setError(undefined);
      setRecordSeconds(0);
      setWaveform(Array(28).fill(0));
      setRecordPaused(false);
      recorder.start(1000);
      setRecording(true);
      recordStartedRef.current = Date.now();
      pauseDurationRef.current = 0;
      pausedAtRef.current = 0;
      recordIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartedRef.current - pauseDurationRef.current
          - (recorder.state === 'paused' ? Date.now() - pausedAtRef.current : 0)) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) stopRecording();
      }, 250);

      if (typeof AudioContext !== 'undefined') {
        try {
          const context = new AudioContext();
          audioContextRef.current = context;
          const source = context.createMediaStreamSource(stream);
          const analyser = context.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const samples = new Uint8Array(analyser.fftSize);
          waveIntervalRef.current = window.setInterval(() => {
            if (recorder.state !== 'recording') return;
            analyser.getByteTimeDomainData(samples);
            const rms = Math.sqrt(samples.reduce((sum, item) => sum + ((item - 128) / 128) ** 2, 0) / samples.length);
            setWaveform(current => [...current.slice(1), Math.min(1, rms * 5)]);
          }, 110);
        } catch {
          // La grabación funciona aunque no se pueda analizar la forma de onda.
        }
      }
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      setError(new Error(t('No se pudo acceder al micrófono.')));
    } finally {
      requestingMicRef.current = false;
    }
  }, [busy, conversationId, processingAudio, recording, releaseMicrophone, setError, setFile, setPendingId, stopRecording]);

  useEffect(() => {
    setRecording(false);
    setProcessingAudio(false);
    return () => {
      recordGenerationRef.current++;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseMicrophone(false);
    };
  }, [conversationId, releaseMicrophone]);

  useEffect(() => {
    const discardHiddenRecording = () => {
      if (!document.hidden || (!recorderRef.current && !requestingMicRef.current)) return;
      recordGenerationRef.current++;
      stopRecording(true);
      setProcessingAudio(false);
    };
    document.addEventListener('visibilitychange', discardHiddenRecording);
    return () => document.removeEventListener('visibilitychange', discardHiddenRecording);
  }, [stopRecording]);

  return {
    recording,
    recordPaused,
    recordSeconds,
    waveform,
    processingAudio,
    startRecording,
    stopRecording,
    toggleRecordPause,
  };
}
