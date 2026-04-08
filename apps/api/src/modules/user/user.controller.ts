import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateUserProfileDto, UserProfileResponseDto } from './dto/user.dto';
import { UserService } from './user.service';

@ApiTags('User')
@ApiBearerAuth()
@Controller('me')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Get the authenticated executive profile and settings' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  getProfile(@CurrentUser('id') userId: string): Promise<UserProfileResponseDto> {
    return this.userService.getProfile(userId);
  }

  @Patch()
  @Roles('EXECUTIVE')
  @ApiOperation({ summary: 'Update the authenticated executive profile and account settings' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.userService.updateProfile(userId, dto);
  }
}
