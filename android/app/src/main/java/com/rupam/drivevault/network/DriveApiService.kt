package com.rupam.drivevault.network

import com.google.gson.annotations.SerializedName
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

// ── DATA TRANSFER OBJECTS (DTOs) ──

data class UserDto(
    val id: String?,
    val name: String?,
    val email: String?,
    val picture: String?
)

data class StorageQuotaDto(
    val limit: String?,
    val usage: String?,
    val usageInDrive: String?,
    val usageInDriveTrash: String?
)

data class StorageAboutDto(
    val storageQuota: StorageQuotaDto?,
    val user: UserDto?
)

data class CategorySizeCount(
    val size: Long,
    val count: Int
)

data class StorageBreakdownDto(
    val image: CategorySizeCount?,
    val video: CategorySizeCount?,
    val document: CategorySizeCount?,
    val audio: CategorySizeCount?,
    val apk: CategorySizeCount?,
    val archive: CategorySizeCount?,
    val folder: CategorySizeCount?,
    val other: CategorySizeCount?
)

data class DriveFileDto(
    val id: String,
    val name: String,
    val mimeType: String?,
    val size: String?,
    val sizeBytes: Long?,
    val modifiedTime: String?,
    val createdTime: String?,
    val thumbnailLink: String?,
    val webViewLink: String?,
    val starred: Boolean?,
    val shared: Boolean?,
    val isHidden: Boolean?,
    val parents: List<String>?
)

data class TicketRequest(
    val tokens: Any
)

data class TicketResponse(
    val ticketId: String
)

data class CreateFolderRequest(
    val name: String,
    val parentId: String? = null
)

data class RenameFileRequest(
    val name: String
)

data class MoveFileRequest(
    val newParentId: String
)

data class StarFileRequest(
    val starred: Boolean
)

data class NativeAuthRequest(
    val code: String
)

data class NativeAuthResponse(
    val user: com.rupam.drivevault.auth.AuthUser,
    val tokens: com.rupam.drivevault.auth.AuthTokens
)

data class PermissionDto(
    val id: String?,
    val role: String?,
    val type: String?,
    val emailAddress: String? = null,
    val displayName: String? = null
)

data class PermissionsAnyoneRequest(
    val role: String?
)

// ── RETROFIT SERVICE INTERFACE ──

interface DriveApiService {


    @POST("api/auth/native")
    suspend fun exchangeNativeAuth(
        @Body request: NativeAuthRequest
    ): Response<NativeAuthResponse>

    @GET("api/drive/about")
    suspend fun getStorageAbout(
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<StorageAboutDto>

    @GET("api/drive/breakdown")
    suspend fun getStorageBreakdown(
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<StorageBreakdownDto>

    @GET("api/drive/files")
    suspend fun getFiles(
        @Header("x-goog-tokens") tokensHeader: String?,
        @Query("folderId") folderId: String? = null,
        @Query("filter") filter: String? = null
    ): Response<List<DriveFileDto>>

    @GET("api/drive/trash")
    suspend fun getTrashFiles(
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<List<DriveFileDto>>

    @GET("api/drive/hidden")
    suspend fun getHiddenFiles(
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<List<DriveFileDto>>

    @POST("api/drive/download/ticket")
    suspend fun createDownloadTicket(
        @Header("x-goog-tokens") tokensHeader: String?,
        @Body request: TicketRequest
    ): Response<TicketResponse>

    @POST("api/drive/folders")
    suspend fun createFolder(
        @Header("x-goog-tokens") tokensHeader: String?,
        @Body request: CreateFolderRequest
    ): Response<DriveFileDto>

    @PATCH("api/drive/files/{id}")
    suspend fun renameFile(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?,
        @Body request: RenameFileRequest
    ): Response<DriveFileDto>

    @POST("api/drive/files/{id}/star")
    suspend fun starFile(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?,
        @Body request: StarFileRequest
    ): Response<Unit>

    @POST("api/drive/files/{id}/move")
    suspend fun moveFile(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?,
        @Body request: MoveFileRequest
    ): Response<Unit>

    @DELETE("api/drive/files/{id}")
    suspend fun trashFile(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<Unit>

    @POST("api/drive/files/{id}/restore")
    suspend fun restoreFile(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<Unit>

    @DELETE("api/drive/files/{id}/permanent")
    suspend fun deletePermanently(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<Unit>

    @Multipart
    @POST("api/drive/upload")
    suspend fun uploadFile(
        @Header("x-goog-tokens") tokensHeader: String?,
        @Part file: MultipartBody.Part,
        @Part("parentId") parentId: RequestBody?,
        @Part("relativePath") relativePath: RequestBody?
    ): Response<DriveFileDto>

    @GET("api/drive/files/{id}/permissions")
    suspend fun getPermissions(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?
    ): Response<List<PermissionDto>>

    @POST("api/drive/files/{id}/permissions-anyone")
    suspend fun setAnyonePermission(
        @Path("id") id: String,
        @Header("x-goog-tokens") tokensHeader: String?,
        @Body request: PermissionsAnyoneRequest
    ): Response<com.google.gson.JsonElement>
}


// ── RETROFIT CLIENT BUILDER ──

object NetworkClient {
    const val BASE_URL = "https://g-drive-vault-api.onrender.com/"

    var onTokenRefreshed: ((com.rupam.drivevault.auth.AuthTokens) -> Unit)? = null

    val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.HEADERS
        }
        val tokenRefreshInterceptor = okhttp3.Interceptor { chain ->
            val response = chain.proceed(chain.request())
            val refreshedJson = response.header("x-refreshed-tokens")
            if (!refreshedJson.isNullOrBlank()) {
                try {
                    val tokens = com.google.gson.Gson().fromJson(refreshedJson, com.rupam.drivevault.auth.AuthTokens::class.java)
                    if (tokens != null) {
                        onTokenRefreshed?.invoke(tokens)
                    }
                } catch (_: Exception) {}
            }
            response
        }

        OkHttpClient.Builder()
            .addInterceptor(tokenRefreshInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    val uploadOkHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)
            .writeTimeout(300, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    val apiService: DriveApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(DriveApiService::class.java)
    }
}
