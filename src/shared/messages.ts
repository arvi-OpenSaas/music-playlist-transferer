import { Playlist, ProviderName, Song, TransferJob, TransferReport } from '@/shared/types';

export enum MessageType {
  START_TRANSFER = 'START_TRANSFER',
  GET_STATUS = 'GET_STATUS',
  PAUSE_TRANSFER = 'PAUSE_TRANSFER',
  RESUME_TRANSFER = 'RESUME_TRANSFER',
  CANCEL_TRANSFER = 'CANCEL_TRANSFER',
  GET_LOGS = 'GET_LOGS',
  GET_REPORT = 'GET_REPORT',
  PROVIDER_CONNECT = 'PROVIDER_CONNECT',
  PROVIDER_DISCONNECT = 'PROVIDER_DISCONNECT',
  PROVIDER_GET_PLAYLISTS = 'PROVIDER_GET_PLAYLISTS',
  PROVIDER_GET_PLAYLIST_SONGS = 'PROVIDER_GET_PLAYLIST_SONGS',
  PROVIDER_SEARCH = 'PROVIDER_SEARCH',
  PROVIDER_CREATE_PLAYLIST = 'PROVIDER_CREATE_PLAYLIST',
  PROVIDER_ADD_SONG = 'PROVIDER_ADD_SONG',
  CONTENT_GET_PLAYLISTS = 'CONTENT_GET_PLAYLISTS',
  CONTENT_GET_PLAYLIST_SONGS = 'CONTENT_GET_PLAYLIST_SONGS',
  CONTENT_SEARCH = 'CONTENT_SEARCH',
  CONTENT_CREATE_PLAYLIST = 'CONTENT_CREATE_PLAYLIST',
  CONTENT_ADD_SONG = 'CONTENT_ADD_SONG',
}

export interface BaseMessage {
  type: MessageType;
  payload?: unknown;
}

export interface StartTransferMessage extends BaseMessage {
  type: MessageType.START_TRANSFER;
  payload: {
    sourceProvider: ProviderName;
    destinationProvider: ProviderName;
    playlistId: string;
  };
}

export interface GetStatusMessage extends BaseMessage {
  type: MessageType.GET_STATUS;
}

export interface PauseTransferMessage extends BaseMessage {
  type: MessageType.PAUSE_TRANSFER;
  payload: {
    jobId: string;
  };
}

export interface ResumeTransferMessage extends BaseMessage {
  type: MessageType.RESUME_TRANSFER;
  payload: {
    jobId: string;
  };
}

export interface CancelTransferMessage extends BaseMessage {
  type: MessageType.CANCEL_TRANSFER;
  payload: {
    jobId: string;
  };
}

export interface ProviderPayloads {
  connect: { provider: ProviderName };
  disconnect: { provider: ProviderName };
  getPlaylists: { provider: ProviderName };
  getPlaylistSongs: { provider: ProviderName; playlistId: string };
  search: { provider: ProviderName; query: string };
  createPlaylist: { provider: ProviderName; name: string };
  addSong: { provider: ProviderName; playlistId: string; song: Song };
}

export interface ProviderMessage<T extends keyof ProviderPayloads> extends BaseMessage {
  type: MessageType;
  payload: ProviderPayloads[T];
}

export interface ContentPlaylistMessage extends BaseMessage {
  type: MessageType.CONTENT_GET_PLAYLISTS;
  payload?: undefined;
}

export interface ContentPlaylistSongsMessage extends BaseMessage {
  type: MessageType.CONTENT_GET_PLAYLIST_SONGS;
  payload: {
    playlistId?: string;
  };
}

export interface ContentSearchMessage extends BaseMessage {
  type: MessageType.CONTENT_SEARCH;
  payload: {
    query: string;
  };
}

export interface ContentCreatePlaylistMessage extends BaseMessage {
  type: MessageType.CONTENT_CREATE_PLAYLIST;
  payload: {
    name: string;
  };
}

export interface ContentAddSongMessage extends BaseMessage {
  type: MessageType.CONTENT_ADD_SONG;
  payload: {
    playlistId: string;
    song: Song;
  };
}

export type HarmonyMessage =
  | StartTransferMessage
  | GetStatusMessage
  | PauseTransferMessage
  | ResumeTransferMessage
  | CancelTransferMessage
  | ProviderMessage<'connect'>
  | ProviderMessage<'disconnect'>
  | ProviderMessage<'getPlaylists'>
  | ProviderMessage<'getPlaylistSongs'>
  | ProviderMessage<'search'>
  | ProviderMessage<'createPlaylist'>
  | ProviderMessage<'addSong'>
  | ContentPlaylistMessage
  | ContentPlaylistSongsMessage
  | ContentSearchMessage
  | ContentCreatePlaylistMessage
  | ContentAddSongMessage;

export interface TransferResponse {
  ok: boolean;
  report?: TransferReport;
  jobs?: TransferJob[];
  error?: string;
}

export interface ProviderSearchRequest {
  query: string;
  provider: ProviderName;
}

export interface ProviderSearchResponse {
  songs: Song[];
}

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type StatusResponse = MessageResponse<TransferJob[]>;
export type PlaylistResponse = MessageResponse<Playlist[]>;
export type SongResponse = MessageResponse<Song[]>;
export type PlaylistCreatedResponse = MessageResponse<Playlist>;
export type ReportResponse = MessageResponse<TransferReport>;
export type LogsResponse = MessageResponse<string[]>;
