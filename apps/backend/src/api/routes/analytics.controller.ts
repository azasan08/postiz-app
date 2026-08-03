import { Controller, Get, Param, Query } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { AllChannelsAnalyticsService } from '@gitroom/nestjs-libraries/database/prisma/analytics/all.channels.analytics.service';
import { AllChannelsAnalyticsDto } from '@gitroom/nestjs-libraries/dtos/analytics/all.channels.analytics.dto';

@ApiTags('Analytics')
@Controller('/analytics')
export class AnalyticsController {
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _allChannelsAnalyticsService: AllChannelsAnalyticsService
  ) {}

  @Get('/all-channels')
  async getAllChannels(
    @GetOrgFromRequest() org: Organization,
    @Query() query: AllChannelsAnalyticsDto
  ) {
    return this._allChannelsAnalyticsService.getAllChannels(
      org,
      query.from,
      query.to
    );
  }

  @Get('/:integration')
  async getIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('date') date: string
  ) {
    return this._integrationService.checkAnalytics(org, integration, date);
  }

  @Get('/post/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string,
    @Query('date') date: string
  ) {
    return this._postsService.checkPostAnalytics(org.id, postId, +date);
  }
}
