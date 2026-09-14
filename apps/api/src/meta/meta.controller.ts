import { Controller, Get } from '@nestjs/common';

@Controller('regions')
export class RegionsController {
  @Get()
  getRegions() {
    return [
      {
        code: 'AE',
        name: 'الإمارات العربية المتحدة',
        cities: [
          { name: 'Abu Dhabi' },
          { name: 'Dubai' },
          { name: 'Sharjah' },
          { name: 'Ajman' },
          { name: 'Ras Al Khaimah' },
          { name: 'Umm Al Quwain' },
          { name: 'Fujairah' },
          { name: 'Al Ain' },
        ],
      },
      {
        code: 'SY',
        name: 'سوريا',
        cities: [
          { name: 'Damascus' },
          { name: 'Aleppo' },
          { name: 'Homs' },
          { name: 'Hama' },
          { name: 'Latakia' },
          { name: 'Tartus' },
          { name: 'Daraa' },
          { name: 'As-Suwayda' },
          { name: 'Idlib' },
        ],
      },
    ];
  }
}
