package thingsboard.v1

import org.noumena.runtime.plugin.NativeImplWithoutRuntimePlugin
import org.noumena.runtime.plugin.NativeFunction
import org.noumena.runtime.plugin.NativeParameter
import org.noumena.runtime.plugin.NativeReturn
import org.noumena.runtime.plugin.NativeType
import java.time.LocalDateTime
import java.util.*

/**
 * ThingsBoard Contributor Library
 * Provides native functions for ThingsBoard-specific operations
 */
class ThingsBoardContributor : NativeImplWithoutRuntimePlugin() {

    /**
     * Validate tenant data according to ThingsBoard rules
     */
    @NativeFunction(
        name = "validateTenantData",
        parameters = [
            NativeParameter("data", NativeType.STRUCT)
        ],
        returns = NativeReturn(NativeType.BOOLEAN)
    )
    fun validateTenantData(data: Map<String, Any>): Boolean {
        val name = data["name"] as? String ?: return false
        val title = data["title"] as? String ?: ""
        val region = data["region"] as? String ?: ""
        val country = data["country"] as? String ?: ""
        val stateName = data["stateName"] as? String ?: ""
        val city = data["city"] as? String ?: ""
        val address = data["address"] as? String ?: ""
        val address2 = data["address2"] as? String ?: ""
        val zip = data["zip"] as? String ?: ""
        val phone = data["phone"] as? String ?: ""
        val email = data["email"] as? String ?: ""
        
        val limits = data["limits"] as? Map<String, Any> ?: return false
        val maxUsers = limits["maxUsers"] as? Number ?: return false
        val maxDevices = limits["maxDevices"] as? Number ?: return false
        val maxAssets = limits["maxAssets"] as? Number ?: return false
        val maxCustomers = limits["maxCustomers"] as? Number ?: return false

        return name.isNotEmpty() &&
               name.length <= 255 &&
               title.length <= 255 &&
               region.length <= 255 &&
               country.length <= 255 &&
               stateName.length <= 255 &&
               city.length <= 255 &&
               address.length <= 255 &&
               address2.length <= 255 &&
               zip.length <= 255 &&
               phone.length <= 255 &&
               email.length <= 255 &&
               maxUsers.toInt() > 0 &&
               maxDevices.toInt() > 0 &&
               maxAssets.toInt() > 0 &&
               maxCustomers.toInt() > 0
    }

    /**
     * Generate a unique tenant ID
     */
    @NativeFunction(
        name = "generateTenantId",
        parameters = [],
        returns = NativeReturn(NativeType.STRING)
    )
    fun generateTenantId(): String {
        return "tenant_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 8)}"
    }

    /**
     * Check if tenant name already exists
     */
    @NativeFunction(
        name = "tenantNameExists",
        parameters = [
            NativeParameter("name", NativeType.STRING),
            NativeParameter("tenantsMap", NativeType.MAP)
        ],
        returns = NativeReturn(NativeType.BOOLEAN)
    )
    fun tenantNameExists(name: String, tenantsMap: Map<String, Any>): Boolean {
        return tenantsMap.values.any { tenant ->
            val tenantData = tenant as? Map<String, Any>
            tenantData?.get("name") == name
        }
    }

    /**
     * Create tenant entity
     */
    @NativeFunction(
        name = "createTenantEntity",
        parameters = [
            NativeParameter("data", NativeType.STRUCT),
            NativeParameter("id", NativeType.STRING)
        ],
        returns = NativeReturn(NativeType.STRUCT)
    )
    fun createTenantEntity(data: Map<String, Any>, id: String): Map<String, Any> {
        val limits = data["limits"] as? Map<String, Any> ?: emptyMap()
        
        return mapOf(
            "id" to id,
            "name" to (data["name"] as? String ?: ""),
            "title" to (data["title"] as? String ?: ""),
            "region" to (data["region"] as? String ?: ""),
            "country" to (data["country"] as? String ?: ""),
            "stateName" to (data["stateName"] as? String ?: ""),
            "city" to (data["city"] as? String ?: ""),
            "address" to (data["address"] as? String ?: ""),
            "address2" to (data["address2"] as? String ?: ""),
            "zip" to (data["zip"] as? String ?: ""),
            "phone" to (data["phone"] as? String ?: ""),
            "email" to (data["email"] as? String ?: ""),
            "limits" to limits,
            "createdTime" to LocalDateTime.now().toString(),
            "additionalInfo" to "{}"
        )
    }

    /**
     * Create tenant info
     */
    @NativeFunction(
        name = "createTenantInfo",
        parameters = [
            NativeParameter("tenant", NativeType.STRUCT)
        ],
        returns = NativeReturn(NativeType.STRUCT)
    )
    fun createTenantInfo(tenant: Map<String, Any>): Map<String, Any> {
        return mapOf(
            "tenant" to tenant,
            "tenantProfileName" to "Default"
        )
    }

    /**
     * Process bulk import of tenants
     */
    @NativeFunction(
        name = "processTenantBulkImport",
        parameters = [
            NativeParameter("tenantDataList", NativeType.LIST),
            NativeParameter("tenants", NativeType.MAP)
        ],
        returns = NativeReturn(NativeType.STRUCT)
    )
    fun processTenantBulkImport(tenantDataList: List<Map<String, Any>>, tenants: Map<String, Any>): Map<String, Any> {
        var successCount = 0
        var failureCount = 0
        val errors = mutableListOf<String>()
        val importedTenants = mutableListOf<Map<String, Any>>()

        for (data in tenantDataList) {
            if (validateTenantData(data) && !tenantNameExists(data["name"] as String, tenants)) {
                val id = generateTenantId()
                val tenant = createTenantEntity(data, id)
                importedTenants.add(tenant)
                successCount++
            } else {
                failureCount++
                if (!validateTenantData(data)) {
                    errors.add("Invalid data for tenant: ${data["name"]}")
                } else {
                    errors.add("Tenant name already exists: ${data["name"]}")
                }
            }
        }

        return mapOf(
            "successCount" to successCount,
            "failureCount" to failureCount,
            "errors" to errors,
            "importedTenants" to importedTenants
        )
    }
} 