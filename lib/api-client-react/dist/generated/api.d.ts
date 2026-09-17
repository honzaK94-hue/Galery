import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Album, AlbumInput, AlbumUpdate, HealthStatus, LibrarySummary, ListPhotosParams, Photo, PhotoInput, UploadUrlInput, UploadUrlResponse } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListPhotosUrl: (params?: ListPhotosParams) => string;
/**
 * @summary List photos
 */
export declare const listPhotos: (params?: ListPhotosParams, options?: Parameters<typeof customFetch>[1]) => Promise<Photo[]>;
export declare const getListPhotosQueryKey: (params?: ListPhotosParams) => readonly ["/api/photos", ...ListPhotosParams[]];
export declare const getListPhotosQueryOptions: <TData = Awaited<ReturnType<typeof listPhotos>>, TError = ErrorType<unknown>>(params?: ListPhotosParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPhotos>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPhotos>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPhotosQueryResult = NonNullable<Awaited<ReturnType<typeof listPhotos>>>;
export type ListPhotosQueryError = ErrorType<unknown>;
/**
 * @summary List photos
 */
export declare function useListPhotos<TData = Awaited<ReturnType<typeof listPhotos>>, TError = ErrorType<unknown>>(params?: ListPhotosParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPhotos>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreatePhotoUrl: () => string;
/**
 * @summary Save uploaded photo metadata
 */
export declare const createPhoto: (photoInput: PhotoInput, options?: Parameters<typeof customFetch>[1]) => Promise<Photo>;
export declare const getCreatePhotoMutationKey: () => readonly ["createPhoto"];
export declare const getCreatePhotoMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPhoto>>, TError, CreatePhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPhoto>>, TError, CreatePhotoMutationVariables, TContext>;
export type CreatePhotoMutationResult = NonNullable<Awaited<ReturnType<typeof createPhoto>>>;
export type CreatePhotoMutationBody = BodyType<PhotoInput>;
export type CreatePhotoMutationError = ErrorType<unknown>;
export type CreatePhotoMutationVariables = {
    data: BodyType<PhotoInput>;
};
/**
* @summary Save uploaded photo metadata
*/
export declare const useCreatePhoto: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPhoto>>, TError, CreatePhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPhoto>>, TError, CreatePhotoMutationVariables, TContext>;
export declare const getDeletePhotoUrl: (photoId: number) => string;
/**
 * @summary Delete a photo
 */
export declare const deletePhoto: (photoId: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeletePhotoMutationKey: () => readonly ["deletePhoto"];
export declare const getDeletePhotoMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePhoto>>, TError, DeletePhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePhoto>>, TError, DeletePhotoMutationVariables, TContext>;
export type DeletePhotoMutationResult = NonNullable<Awaited<ReturnType<typeof deletePhoto>>>;
export type DeletePhotoMutationError = ErrorType<void>;
export type DeletePhotoMutationVariables = {
    photoId: number;
};
/**
* @summary Delete a photo
*/
export declare const useDeletePhoto: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePhoto>>, TError, DeletePhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePhoto>>, TError, DeletePhotoMutationVariables, TContext>;
export declare const getListAlbumsUrl: () => string;
/**
 * @summary List albums
 */
export declare const listAlbums: (options?: Parameters<typeof customFetch>[1]) => Promise<Album[]>;
export declare const getListAlbumsQueryKey: () => readonly ["/api/albums"];
export declare const getListAlbumsQueryOptions: <TData = Awaited<ReturnType<typeof listAlbums>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAlbums>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAlbums>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAlbumsQueryResult = NonNullable<Awaited<ReturnType<typeof listAlbums>>>;
export type ListAlbumsQueryError = ErrorType<unknown>;
/**
 * @summary List albums
 */
export declare function useListAlbums<TData = Awaited<ReturnType<typeof listAlbums>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAlbums>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateAlbumUrl: () => string;
/**
 * @summary Create an album
 */
export declare const createAlbum: (albumInput: AlbumInput, options?: Parameters<typeof customFetch>[1]) => Promise<Album>;
export declare const getCreateAlbumMutationKey: () => readonly ["createAlbum"];
export declare const getCreateAlbumMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAlbum>>, TError, CreateAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAlbum>>, TError, CreateAlbumMutationVariables, TContext>;
export type CreateAlbumMutationResult = NonNullable<Awaited<ReturnType<typeof createAlbum>>>;
export type CreateAlbumMutationBody = BodyType<AlbumInput>;
export type CreateAlbumMutationError = ErrorType<unknown>;
export type CreateAlbumMutationVariables = {
    data: BodyType<AlbumInput>;
};
/**
* @summary Create an album
*/
export declare const useCreateAlbum: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAlbum>>, TError, CreateAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAlbum>>, TError, CreateAlbumMutationVariables, TContext>;
export declare const getUpdateAlbumUrl: (albumId: number) => string;
/**
 * @summary Rename an album
 */
export declare const updateAlbum: (albumId: number, albumUpdate: AlbumUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<Album>;
export declare const getUpdateAlbumMutationKey: () => readonly ["updateAlbum"];
export declare const getUpdateAlbumMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAlbum>>, TError, UpdateAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAlbum>>, TError, UpdateAlbumMutationVariables, TContext>;
export type UpdateAlbumMutationResult = NonNullable<Awaited<ReturnType<typeof updateAlbum>>>;
export type UpdateAlbumMutationBody = BodyType<AlbumUpdate>;
export type UpdateAlbumMutationError = ErrorType<unknown>;
export type UpdateAlbumMutationVariables = {
    albumId: number;
    data: BodyType<AlbumUpdate>;
};
/**
* @summary Rename an album
*/
export declare const useUpdateAlbum: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAlbum>>, TError, UpdateAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAlbum>>, TError, UpdateAlbumMutationVariables, TContext>;
export declare const getDeleteAlbumUrl: (albumId: number) => string;
/**
 * @summary Delete an album
 */
export declare const deleteAlbum: (albumId: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteAlbumMutationKey: () => readonly ["deleteAlbum"];
export declare const getDeleteAlbumMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAlbum>>, TError, DeleteAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAlbum>>, TError, DeleteAlbumMutationVariables, TContext>;
export type DeleteAlbumMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAlbum>>>;
export type DeleteAlbumMutationError = ErrorType<void>;
export type DeleteAlbumMutationVariables = {
    albumId: number;
};
/**
* @summary Delete an album
*/
export declare const useDeleteAlbum: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAlbum>>, TError, DeleteAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAlbum>>, TError, DeleteAlbumMutationVariables, TContext>;
export declare const getAddPhotoToAlbumUrl: (albumId: number, photoId: number) => string;
/**
 * @summary Add a photo to an album
 */
export declare const addPhotoToAlbum: (albumId: number, photoId: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAddPhotoToAlbumMutationKey: () => readonly ["addPhotoToAlbum"];
export declare const getAddPhotoToAlbumMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPhotoToAlbum>>, TError, AddPhotoToAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addPhotoToAlbum>>, TError, AddPhotoToAlbumMutationVariables, TContext>;
export type AddPhotoToAlbumMutationResult = NonNullable<Awaited<ReturnType<typeof addPhotoToAlbum>>>;
export type AddPhotoToAlbumMutationError = ErrorType<void>;
export type AddPhotoToAlbumMutationVariables = {
    albumId: number;
    photoId: number;
};
/**
* @summary Add a photo to an album
*/
export declare const useAddPhotoToAlbum: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPhotoToAlbum>>, TError, AddPhotoToAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addPhotoToAlbum>>, TError, AddPhotoToAlbumMutationVariables, TContext>;
export declare const getRemovePhotoFromAlbumUrl: (albumId: number, photoId: number) => string;
/**
 * @summary Remove a photo from an album
 */
export declare const removePhotoFromAlbum: (albumId: number, photoId: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getRemovePhotoFromAlbumMutationKey: () => readonly ["removePhotoFromAlbum"];
export declare const getRemovePhotoFromAlbumMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePhotoFromAlbum>>, TError, RemovePhotoFromAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removePhotoFromAlbum>>, TError, RemovePhotoFromAlbumMutationVariables, TContext>;
export type RemovePhotoFromAlbumMutationResult = NonNullable<Awaited<ReturnType<typeof removePhotoFromAlbum>>>;
export type RemovePhotoFromAlbumMutationError = ErrorType<void>;
export type RemovePhotoFromAlbumMutationVariables = {
    albumId: number;
    photoId: number;
};
/**
* @summary Remove a photo from an album
*/
export declare const useRemovePhotoFromAlbum: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePhotoFromAlbum>>, TError, RemovePhotoFromAlbumMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removePhotoFromAlbum>>, TError, RemovePhotoFromAlbumMutationVariables, TContext>;
export declare const getGetLibrarySummaryUrl: () => string;
/**
 * @summary Get library totals
 */
export declare const getLibrarySummary: (options?: Parameters<typeof customFetch>[1]) => Promise<LibrarySummary>;
export declare const getGetLibrarySummaryQueryKey: () => readonly ["/api/library-summary"];
export declare const getGetLibrarySummaryQueryOptions: <TData = Awaited<ReturnType<typeof getLibrarySummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLibrarySummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLibrarySummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLibrarySummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getLibrarySummary>>>;
export type GetLibrarySummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get library totals
 */
export declare function useGetLibrarySummary<TData = Awaited<ReturnType<typeof getLibrarySummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLibrarySummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getRequestUploadUrlUrl: () => string;
/**
 * @summary Request an object storage upload URL
 */
export declare const requestUploadUrl: (uploadUrlInput: UploadUrlInput, options?: Parameters<typeof customFetch>[1]) => Promise<UploadUrlResponse>;
export declare const getRequestUploadUrlMutationKey: () => readonly ["requestUploadUrl"];
export declare const getRequestUploadUrlMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, RequestUploadUrlMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, RequestUploadUrlMutationVariables, TContext>;
export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>;
export type RequestUploadUrlMutationBody = BodyType<UploadUrlInput>;
export type RequestUploadUrlMutationError = ErrorType<unknown>;
export type RequestUploadUrlMutationVariables = {
    data: BodyType<UploadUrlInput>;
};
/**
* @summary Request an object storage upload URL
*/
export declare const useRequestUploadUrl: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, RequestUploadUrlMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof requestUploadUrl>>, TError, RequestUploadUrlMutationVariables, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map