import PhoneExtension from '../models/PhoneExtension.js';
import Room from '../models/Room.js';
import mongoose from 'mongoose';

class PhoneDirectoryService {
  
  /**
   * Generate a comprehensive phone directory for a hotel
   */
  async generateDirectory(hotelId, options = {}) {
    try {
      const {
        category = null,
        includeInternal = false,
        sortBy = 'category',
        includeInactive = false
      } = options;

      // Base query for directory listing
      const query = {
        hotelId: mongoose.Types.ObjectId(hotelId),
        'directorySettings.showInDirectory': true
      };

      // Add filters
      if (!includeInternal) {
        query['directorySettings.publicListing'] = true;
      }

      if (!includeInactive) {
        query.status = 'active';
      }

      if (category) {
        query['directorySettings.category'] = category;
      }

      // Fetch extensions with room information
      const extensions = await PhoneExtension.find(query)
        .populate('roomInfo', 'roomNumber floor roomType')
        .sort({
          'directorySettings.category': 1,
          'directorySettings.sortOrder': 1,
          extensionNumber: 1
        })
        .lean();

      // Group extensions by category
      const directory = {
        metadata: {
          hotelId,
          generatedAt: new Date(),
          totalEntries: extensions.length,
          includeInternal,
          category: category || 'all'
        },
        categories: {}
      };

      // Process extensions and group by category
      extensions.forEach(ext => {
        const categoryKey = ext.directorySettings.category;
        
        if (!directory.categories[categoryKey]) {
          directory.categories[categoryKey] = {
            name: this._getCategoryDisplayName(categoryKey),
            entries: []
          };
        }

        const entry = {
          extensionNumber: ext.extensionNumber,
          displayName: ext.displayName,
          description: ext.description,
          phoneType: ext.phoneType,
          location: {
            floor: ext.location?.floor,
            wing: ext.location?.wing,
            area: ext.location?.area
          },
          room: ext.roomInfo ? {
            number: ext.roomInfo.roomNumber,
            floor: ext.roomInfo.floor,
            type: ext.roomInfo.roomType
          } : null,
          features: ext.features || [],
          isAvailable: ext.isAvailable && ext.status === 'active'
        };

        directory.categories[categoryKey].entries.push(entry);
      });

      // Sort categories for consistent display
      const sortedDirectory = {
        ...directory,
        categories: this._sortDirectoryCategories(directory.categories)
      };

      return sortedDirectory;

    } catch (error) {
      console.error('Error generating directory:', error);
      throw new Error(`Failed to generate phone directory: ${error.message}`);
    }
  }

  /**
   * Generate directory in CSV format
   */
  async generateDirectoryCSV(directory) {
    try {
      const csvRows = [];
      
      // CSV Header
      csvRows.push([
        'Category',
        'Extension',
        'Display Name',
        'Description', 
        'Phone Type',
        'Room Number',
        'Floor',
        'Wing',
        'Area',
        'Available'
      ].join(','));

      // Process each category
      Object.entries(directory.categories).forEach(([categoryKey, category]) => {
        category.entries.forEach(entry => {
          const row = [
            category.name,
            entry.extensionNumber,
            `"${entry.displayName}"`,
            `"${entry.description || ''}"`,
            entry.phoneType,
            entry.room?.number || '',
            entry.location?.floor || '',
            entry.location?.wing || '',
            entry.location?.area || '',
            entry.isAvailable ? 'Yes' : 'No'
          ];
          
          csvRows.push(row.join(','));
        });
      });

      return csvRows.join('\n');

    } catch (error) {
      console.error('Error generating CSV:', error);
      throw new Error(`Failed to generate CSV directory: ${error.message}`);
    }
  }

  /**
   * Generate directory in PDF format (placeholder - would need PDF library)
   */
  async generateDirectoryPDF(directory) {
    try {
      // This would require a PDF generation library like puppeteer or PDFKit
      // For now, returning a simple text representation
      
      let pdfContent = `PHONE DIRECTORY\n\n`;
      pdfContent += `Generated: ${directory.metadata.generatedAt.toLocaleString()}\n`;
      pdfContent += `Total Entries: ${directory.metadata.totalEntries}\n\n`;

      Object.entries(directory.categories).forEach(([categoryKey, category]) => {
        pdfContent += `${category.name.toUpperCase()}\n`;
        pdfContent += '='.repeat(category.name.length) + '\n\n';

        category.entries.forEach(entry => {
          pdfContent += `${entry.extensionNumber} - ${entry.displayName}\n`;
          if (entry.room) {
            pdfContent += `   Room: ${entry.room.number} (Floor ${entry.room.floor})\n`;
          }
          if (entry.description) {
            pdfContent += `   ${entry.description}\n`;
          }
          pdfContent += `   Type: ${entry.phoneType} | Available: ${entry.isAvailable ? 'Yes' : 'No'}\n\n`;
        });

        pdfContent += '\n';
      });

      // Return as buffer (in real implementation, would generate actual PDF)
      return Buffer.from(pdfContent, 'utf-8');

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error(`Failed to generate PDF directory: ${error.message}`);
    }
  }

  /**
   * Bulk assign extensions to rooms
   */
  async bulkAssignExtensions(hotelId, assignments, updatedBy) {
    try {
      const results = {
        successCount: 0,
        failureCount: 0,
        errors: []
      };

      for (const assignment of assignments) {
        try {
          const { extensionId, roomId } = assignment;

          // Validate room exists and belongs to hotel
          if (roomId) {
            const room = await Room.findOne({ 
              _id: roomId, 
              hotelId: mongoose.Types.ObjectId(hotelId) 
            });
            
            if (!room) {
              results.errors.push({
                extensionId,
                error: 'Room not found or does not belong to this hotel'
              });
              results.failureCount++;
              continue;
            }
          }

          // Update the extension
          const extension = await PhoneExtension.findOneAndUpdate(
            { 
              _id: extensionId, 
              hotelId: mongoose.Types.ObjectId(hotelId) 
            },
            {
              roomId: roomId || null,
              'auditInfo.updatedBy': updatedBy,
              'auditInfo.lastModified': new Date()
            },
            { new: true }
          );

          if (!extension) {
            results.errors.push({
              extensionId,
              error: 'Extension not found or does not belong to this hotel'
            });
            results.failureCount++;
            continue;
          }

          results.successCount++;

        } catch (assignmentError) {
          results.errors.push({
            extensionId: assignment.extensionId,
            error: assignmentError.message
          });
          results.failureCount++;
        }
      }

      return results;

    } catch (error) {
      console.error('Error bulk assigning extensions:', error);
      throw new Error(`Failed to bulk assign extensions: ${error.message}`);
    }
  }

  /**
   * Generate usage report
   */
  async generateUsageReport(hotelId, options = {}) {
    try {
      const {
        dateRange = {},
        phoneType = null,
        includeHistory = false
      } = options;

      // Build match criteria
      const matchCriteria = {
        hotelId: mongoose.Types.ObjectId(hotelId)
      };

      if (phoneType) {
        matchCriteria.phoneType = phoneType;
      }

      // Add date range filtering if provided
      if (dateRange.startDate || dateRange.endDate) {
        matchCriteria['usageStats.lastUsed'] = {};
        if (dateRange.startDate) {
          matchCriteria['usageStats.lastUsed'].$gte = new Date(dateRange.startDate);
        }
        if (dateRange.endDate) {
          matchCriteria['usageStats.lastUsed'].$lte = new Date(dateRange.endDate);
        }
      }

      // Aggregate usage statistics
      const usageReport = await PhoneExtension.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$phoneType',
            totalExtensions: { $sum: 1 },
            activeExtensions: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'active'] },
                  1,
                  0
                ]
              }
            },
            totalCallsReceived: { $sum: '$usageStats.totalCallsReceived' },
            totalCallsMade: { $sum: '$usageStats.totalCallsMade' },
            averageDailyUsage: { $avg: '$usageStats.averageDailyUsage' },
            mostUsedExtensions: {
              $push: {
                extensionNumber: '$extensionNumber',
                displayName: '$displayName',
                totalCalls: {
                  $add: ['$usageStats.totalCallsReceived', '$usageStats.totalCallsMade']
                },
                lastUsed: '$usageStats.lastUsed'
              }
            }
          }
        },
        {
          $addFields: {
            mostUsedExtensions: {
              $slice: [
                {
                  $sortArray: {
                    input: '$mostUsedExtensions',
                    sortBy: { totalCalls: -1 }
                  }
                },
                5
              ]
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get peak usage times across all extensions
      const peakUsageData = await PhoneExtension.aggregate([
        { $match: matchCriteria },
        { $unwind: '$usageStats.peakUsageHours' },
        {
          $group: {
            _id: '$usageStats.peakUsageHours.hour',
            totalCalls: { $sum: '$usageStats.peakUsageHours.callCount' },
            extensionCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get underutilized extensions
      const underutilizedExtensions = await PhoneExtension.find({
        ...matchCriteria,
        status: 'active',
        $or: [
          { 'usageStats.totalCallsReceived': { $lt: 5 } },
          { 'usageStats.totalCallsMade': { $lt: 5 } },
          { 'usageStats.lastUsed': { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        ]
      })
      .select('extensionNumber displayName usageStats roomNumber location')
      .limit(20);

      const report = {
        metadata: {
          hotelId,
          generatedAt: new Date(),
          dateRange,
          phoneType: phoneType || 'all'
        },
        summary: {
          totalExtensions: usageReport.reduce((sum, item) => sum + item.totalExtensions, 0),
          activeExtensions: usageReport.reduce((sum, item) => sum + item.activeExtensions, 0),
          totalCallsReceived: usageReport.reduce((sum, item) => sum + item.totalCallsReceived, 0),
          totalCallsMade: usageReport.reduce((sum, item) => sum + item.totalCallsMade, 0)
        },
        byPhoneType: usageReport,
        peakUsageHours: peakUsageData,
        underutilizedExtensions
      };

      return report;

    } catch (error) {
      console.error('Error generating usage report:', error);
      throw new Error(`Failed to generate usage report: ${error.message}`);
    }
  }

  /**
   * Auto-assign extensions to rooms based on patterns
   */
  async autoAssignExtensions(hotelId, pattern = 'room_number', updatedBy) {
    try {
      // Get unassigned extensions
      const unassignedExtensions = await PhoneExtension.find({
        hotelId: mongoose.Types.ObjectId(hotelId),
        roomId: null,
        phoneType: 'room_phone',
        status: 'active'
      }).sort({ extensionNumber: 1 });

      // Get available rooms
      const availableRooms = await Room.find({
        hotelId: mongoose.Types.ObjectId(hotelId),
        status: { $in: ['available', 'occupied', 'maintenance'] }
      }).sort({ roomNumber: 1 });

      const assignments = [];
      const results = {
        successCount: 0,
        failureCount: 0,
        errors: []
      };

      if (pattern === 'room_number') {
        // Try to match extension numbers to room numbers
        for (const extension of unassignedExtensions) {
          const matchingRoom = availableRooms.find(room => {
            // Extract numeric part of extension and room numbers
            const extNum = extension.extensionNumber.replace(/\D/g, '');
            const roomNum = room.roomNumber.replace(/\D/g, '');
            
            return extNum === roomNum || extNum.endsWith(roomNum);
          });

          if (matchingRoom) {
            assignments.push({
              extensionId: extension._id,
              roomId: matchingRoom._id
            });
          }
        }
      } else if (pattern === 'sequential') {
        // Assign extensions sequentially to rooms
        const maxAssignments = Math.min(unassignedExtensions.length, availableRooms.length);
        
        for (let i = 0; i < maxAssignments; i++) {
          assignments.push({
            extensionId: unassignedExtensions[i]._id,
            roomId: availableRooms[i]._id
          });
        }
      }

      // Execute the assignments
      if (assignments.length > 0) {
        const assignmentResults = await this.bulkAssignExtensions(
          hotelId,
          assignments,
          updatedBy
        );
        
        return {
          ...assignmentResults,
          pattern,
          totalPossibleAssignments: assignments.length
        };
      }

      return {
        successCount: 0,
        failureCount: 0,
        errors: [],
        pattern,
        totalPossibleAssignments: 0
      };

    } catch (error) {
      console.error('Error auto-assigning extensions:', error);
      throw new Error(`Failed to auto-assign extensions: ${error.message}`);
    }
  }

  /**
   * Validate directory consistency
   */
  async validateDirectoryConsistency(hotelId) {
    try {
      const issues = [];

      // Check for duplicate extension numbers
      const duplicateExtensions = await PhoneExtension.aggregate([
        { $match: { hotelId: mongoose.Types.ObjectId(hotelId) } },
        { $group: { _id: '$extensionNumber', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]);

      duplicateExtensions.forEach(dup => {
        issues.push({
          type: 'duplicate_extension',
          message: `Extension number ${dup._id} is duplicated`,
          severity: 'high'
        });
      });

      // Check for rooms without extensions
      const roomsWithoutExtensions = await Room.aggregate([
        { $match: { hotelId: mongoose.Types.ObjectId(hotelId) } },
        {
          $lookup: {
            from: 'phoneextensions',
            localField: '_id',
            foreignField: 'roomId',
            as: 'extensions'
          }
        },
        { $match: { extensions: { $size: 0 } } },
        { $project: { roomNumber: 1 } }
      ]);

      if (roomsWithoutExtensions.length > 0) {
        issues.push({
          type: 'rooms_without_extensions',
          message: `${roomsWithoutExtensions.length} rooms have no phone extensions`,
          severity: 'medium',
          details: roomsWithoutExtensions.slice(0, 10).map(r => r.roomNumber)
        });
      }

      // Check for inactive extensions assigned to active rooms
      const inactiveAssignedExtensions = await PhoneExtension.find({
        hotelId: mongoose.Types.ObjectId(hotelId),
        status: { $ne: 'active' },
        roomId: { $ne: null }
      }).populate('roomInfo', 'roomNumber status');

      const problematicExtensions = inactiveAssignedExtensions.filter(
        ext => ext.roomInfo?.status === 'available'
      );

      if (problematicExtensions.length > 0) {
        issues.push({
          type: 'inactive_extensions_active_rooms',
          message: `${problematicExtensions.length} inactive extensions assigned to available rooms`,
          severity: 'medium'
        });
      }

      return {
        hotelId,
        validatedAt: new Date(),
        totalIssues: issues.length,
        issues
      };

    } catch (error) {
      console.error('Error validating directory consistency:', error);
      throw new Error(`Failed to validate directory consistency: ${error.message}`);
    }
  }

  // Helper methods
  _getCategoryDisplayName(categoryKey) {
    const categoryNames = {
      guest_rooms: 'Guest Rooms',
      common_areas: 'Common Areas',
      staff: 'Staff',
      services: 'Services',
      emergency: 'Emergency',
      admin: 'Administration'
    };

    return categoryNames[categoryKey] || categoryKey;
  }

  _sortDirectoryCategories(categories) {
    const categoryOrder = [
      'guest_rooms',
      'common_areas', 
      'services',
      'staff',
      'admin',
      'emergency'
    ];

    const sorted = {};
    
    // Add categories in preferred order
    categoryOrder.forEach(key => {
      if (categories[key]) {
        sorted[key] = categories[key];
      }
    });

    // Add any remaining categories
    Object.keys(categories).forEach(key => {
      if (!sorted[key]) {
        sorted[key] = categories[key];
      }
    });

    return sorted;
  }
}

export default new PhoneDirectoryService();